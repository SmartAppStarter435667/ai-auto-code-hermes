// apps/ai-service/src/agent/HermesAgent.ts
//
// Hermes: Agentic RAG coding assistant (interactive chat mode)
// ─ Long-term memory via mem0ai
// ─ RAG retrieval from Cloudflare Vectorize
// ─ Agentic tool-calling loop — now delegated to agenticLoop.ts, shared with
//   the one-shot CI Auto-Fix path in ciFix.ts (see that file's header for why)
// ─ Streaming via Anthropic SDK
// ─ State persisted in Durable Object SQLite (via agents SDK)

import { Agent, type Connection } from 'agents';
import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../index';
import { buildSystemPrompt } from './prompts';
import { buildTools } from '../tools/index';
import { queryRAG, ingestDocument } from './rag';
import { runAgenticLoop, type AgentLoopEvent } from './agenticLoop';
import type { AgentState, WSMessage, ChatMessage } from './types';

const MEM0_BASE = 'https://api.mem0.ai/v1';

async function mem0Search(
  apiKey: string,
  query: string,
  userId: string,
  limit = 10,
): Promise<Array<{ memory: string }>> {
  const res = await fetch(`${MEM0_BASE}/memories/search/`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, user_id: userId, limit }),
  });
  if (!res.ok) return [];
  const data = await res.json<Array<{ memory: string }>>();
  return Array.isArray(data) ? data : [];
}

async function mem0Add(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await fetch(`${MEM0_BASE}/memories/`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, user_id: userId, metadata }),
  });
}

async function mem0DeleteAll(apiKey: string, userId: string): Promise<void> {
  await fetch(`${MEM0_BASE}/memories/?user_id=${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Token ${apiKey}` },
  });
}

export class HermesAgent extends Agent<Env, AgentState> {
  private anthropic!: Anthropic;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/state')) {
      return Response.json(this.state ?? this.defaultState('anonymous'));
    }

    if (url.pathname.endsWith('/memories') && request.method === 'GET') {
      const userId = url.searchParams.get('userId') ?? 'default';
      const res = await fetch(`${MEM0_BASE}/memories/?user_id=${userId}`, {
        headers: { Authorization: `Token ${this.env.MEM0_API_KEY}` },
      });
      const data = res.ok ? await res.json() : [];
      return Response.json({ memories: data });
    }

    if (url.pathname.endsWith('/ingest') && request.method === 'POST') {
      const body = await request.json<{ text: string; metadata?: Record<string, unknown> }>();
      await ingestDocument(this.env, body.text, body.metadata ?? {});
      return Response.json({ success: true });
    }

    return new Response('Send a WebSocket upgrade to chat', { status: 200 });
  }

  async onConnect(connection: Connection): Promise<void> {
    connection.accept();
    this.send(connection, { type: 'connected', agentId: this.name, state: this.state });
  }

  async onMessage(connection: Connection, message: string | ArrayBuffer): Promise<void> {
    let msg: WSMessage;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      this.send(connection, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    switch (msg.type) {
      case 'chat':
        await this.handleChat(connection, msg).catch((err) => {
          console.error('[HermesAgent] chat error:', err);
          this.send(connection, { type: 'error', message: String(err) });
        });
        break;
      case 'ingest':
        await this.handleIngest(connection, msg).catch((err) => {
          this.send(connection, { type: 'error', message: String(err) });
        });
        break;
      case 'clear_memory':
        await this.handleClearMemory(connection, msg);
        break;
      case 'set_context':
        await this.handleSetContext(connection, msg);
        break;
      case 'ping':
        this.send(connection, { type: 'pong' });
        break;
      default:
        this.send(connection, { type: 'error', message: `Unknown type: ${msg.type}` });
    }
  }

  onClose(connection: Connection, code: number, reason: string): void {
    console.log(`[HermesAgent] WS closed: ${code} ${reason}`);
  }

  onError(connection: Connection, error: unknown): void {
    console.error('[HermesAgent] WS error:', error);
  }

  private async handleChat(connection: Connection, msg: WSMessage): Promise<void> {
    const userId = msg.userId ?? 'default';
    const sessionId = msg.sessionId ?? crypto.randomUUID();
    const userContent = msg.content ?? '';

    const state: AgentState = this.state ?? this.defaultState(userId, sessionId);

    let memories: Array<{ memory: string }> = [];
    try {
      memories = await mem0Search(this.env.MEM0_API_KEY, userContent, userId);
    } catch (err) {
      console.warn('[mem0] search failed:', err);
    }

    let ragContext: string[] = [];
    try {
      ragContext = await queryRAG(this.env, userContent, 5);
    } catch (err) {
      console.warn('[RAG] query failed:', err);
    }

    const systemPrompt = buildSystemPrompt({
      memories: memories.map((m) => m.memory),
      ragContext,
      projectContext: state.projectContext,
    });

    const historyMessages: Anthropic.MessageParam[] = state.messages
      .slice(-30)
      .map((m) => ({ role: m.role, content: m.content }));
    historyMessages.push({ role: 'user', content: userContent });

    const tools = buildTools(state.projectContext);

    this.send(connection, { type: 'stream_start', sessionId });

    // Delegate to the shared loop — this Agent's only job now is to forward
    // loop events onto the live WebSocket connection.
    const forwardEvent = (e: AgentLoopEvent) => {
      if (e.type === 'stream_chunk') {
        this.send(connection, { type: 'stream_chunk', content: e.content, sessionId });
      } else if (e.type === 'tool_call') {
        this.send(connection, { type: 'tool_call', sessionId, tool: e.tool, input: e.input });
      } else if (e.type === 'tool_result') {
        this.send(connection, { type: 'tool_result', sessionId, tool: e.tool, result: e.result, isError: e.isError });
      }
    };

    const { finalResponse, toolCallsLog } = await runAgenticLoop({
      anthropic: this.anthropic,
      env: this.env,
      systemPrompt,
      messages: historyMessages,
      tools,
      maxIterations: 12,
      onEvent: forwardEvent,
    });

    const newMessages: ChatMessage[] = [
      ...state.messages,
      { role: 'user', content: userContent, timestamp: Date.now() },
      { role: 'assistant', content: finalResponse, timestamp: Date.now() },
    ].slice(-60);

    this.setState({ ...state, messages: newMessages, lastActive: Date.now() });

    mem0Add(
      this.env.MEM0_API_KEY,
      [
        { role: 'user', content: userContent },
        { role: 'assistant', content: finalResponse },
      ],
      userId,
      { repo: state.projectContext.repo, ts: new Date().toISOString() },
    ).catch((err) => console.warn('[mem0] add failed:', err));

    this.send(connection, { type: 'stream_end', sessionId, toolCallsLog });
  }

  private async handleIngest(connection: Connection, msg: WSMessage): Promise<void> {
    if (!msg.text) {
      this.send(connection, { type: 'error', message: 'No text provided' });
      return;
    }
    await ingestDocument(this.env, msg.text, msg.metadata ?? {});
    this.send(connection, { type: 'ingest_success' });
  }

  private async handleClearMemory(connection: Connection, msg: WSMessage): Promise<void> {
    const userId = msg.userId ?? 'default';
    try {
      await mem0DeleteAll(this.env.MEM0_API_KEY, userId);
      const state = this.state ?? this.defaultState(userId);
      this.setState({ ...state, messages: [] });
      this.send(connection, { type: 'memory_cleared' });
    } catch (err) {
      this.send(connection, { type: 'error', message: `Clear failed: ${err}` });
    }
  }

  private async handleSetContext(connection: Connection, msg: WSMessage): Promise<void> {
    const state = this.state ?? this.defaultState(msg.userId ?? 'default');
    this.setState({ ...state, projectContext: { ...state.projectContext, ...msg.context } });
    this.send(connection, { type: 'context_updated', context: state.projectContext });
  }

  private send(connection: Connection, data: unknown): void {
    connection.send(JSON.stringify(data));
  }

  private defaultState(userId: string, sessionId?: string): AgentState {
    return {
      messages: [],
      userId,
      sessionId: sessionId ?? crypto.randomUUID(),
      projectContext: {},
      lastActive: Date.now(),
    };
  }
}
