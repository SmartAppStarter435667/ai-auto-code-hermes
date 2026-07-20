// apps/ai-service/src/agent/agenticLoop.ts
//
// The core tool-calling loop, shared by HermesAgent (interactive chat) and
// ciFix.ts (one-shot CI autofix). Callers always build/store conversation
// history in Anthropic.MessageParam[] shape — that stays the one canonical
// format for chat state (mem0, Durable Object state, etc.). Provider choice
// is purely an internal concern of THIS file: when provider is 'nvidia',
// history gets converted to OpenAI shape for that call and back again,
// external callers never need to know or care.

import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../index';
import { executeTool } from '../tools/index';
import {
  callNvidiaChat,
  anthropicMessagesToOpenAI,
  DEFAULT_NVIDIA_MODEL,
  type OAIMessage,
} from './providers/nvidia';

export interface AgentLoopEvent {
  type: 'stream_chunk' | 'tool_call' | 'tool_result';
  content?: string;
  tool?: string;
  input?: unknown;
  result?: unknown;
  isError?: boolean;
}

export type AiProvider = 'anthropic' | 'nvidia';

export interface AgenticLoopParams {
  anthropic: Anthropic;
  env: Env;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  maxIterations?: number;
  model?: string;
  provider?: AiProvider; // defaults to 'anthropic'
  onEvent?: (event: AgentLoopEvent) => void;
}

export interface AgenticLoopResult {
  finalResponse: string;
  toolCallsLog: Array<{ tool: string; result: unknown }>;
  iterations: number;
}

const DEFAULT_MODEL = 'claude-opus-4-20250514';
const DEFAULT_MAX_ITERATIONS = 12;

export async function runAgenticLoop(params: AgenticLoopParams): Promise<AgenticLoopResult> {
  const provider = params.provider ?? 'anthropic';

  if (provider === 'nvidia') {
    return runNvidiaLoop(params);
  }
  return runAnthropicLoop(params);
}

// ─────────────────────────────────────────────────────────────────────────
// Anthropic path (default, tool-calling verified reliable — see HermesAgent)
// ─────────────────────────────────────────────────────────────────────────

async function runAnthropicLoop(params: AgenticLoopParams): Promise<AgenticLoopResult> {
  const {
    anthropic, env, systemPrompt, tools, onEvent,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    model = DEFAULT_MODEL,
  } = params;

  let messages = [...params.messages];
  let finalResponse = '';
  let iterations = 0;
  const toolCallsLog: Array<{ tool: string; result: unknown }> = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    let textAccum = '';
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    const stream = anthropic.messages.stream({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? { type: 'auto' } : undefined,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        textAccum += event.delta.text;
        onEvent?.({ type: 'stream_chunk', content: event.delta.text });
      }
    }

    const finalMsg = await stream.finalMessage();

    for (const block of finalMsg.content) {
      if (block.type === 'tool_use') toolUseBlocks.push(block);
      if (block.type === 'text') finalResponse = block.text;
    }

    if (toolUseBlocks.length === 0 || finalMsg.stop_reason === 'end_turn') {
      finalResponse =
        finalMsg.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('') || textAccum;
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const tu of toolUseBlocks) {
      onEvent?.({ type: 'tool_call', tool: tu.name, input: tu.input });

      let result: unknown;
      let isError = false;
      try {
        result = await executeTool(env, tu.name, tu.input as Record<string, unknown>);
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : String(err)}`;
        isError = true;
      }

      toolCallsLog.push({ tool: tu.name, result });
      onEvent?.({ type: 'tool_result', tool: tu.name, result, isError });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
        is_error: isError,
      });
    }

    messages = [
      ...messages,
      { role: 'assistant', content: finalMsg.content },
      { role: 'user', content: toolResults },
    ];

    if (iter === maxIterations - 2) {
      messages.push({
        role: 'user',
        content:
          'You have one tool-call round left after this. If you are not confident the fix is verified, stop here and summarize status instead of rushing.',
      });
    }
  }

  return { finalResponse, toolCallsLog, iterations };
}

// ─────────────────────────────────────────────────────────────────────────
// NVIDIA NIM path — free-tier alternative. Tool-calling reliability varies
// by open model (see providers/nvidia.ts); malformed tool JSON is surfaced
// to the model rather than silently dropped, so it can usually self-correct
// on the next round, but this path is inherently less battle-tested than
// the Anthropic one for complex multi-step tool sequences.
// ─────────────────────────────────────────────────────────────────────────

async function runNvidiaLoop(params: AgenticLoopParams): Promise<AgenticLoopResult> {
  const { env, systemPrompt, tools, onEvent, maxIterations = DEFAULT_MAX_ITERATIONS } = params;
  const model = env.NVIDIA_MODEL_ID || DEFAULT_NVIDIA_MODEL;

  if (!env.NVIDIA_API_KEY) {
    throw new Error('AI_PROVIDER=nvidia but NVIDIA_API_KEY is not set');
  }

  let oaiMessages: OAIMessage[] = anthropicMessagesToOpenAI(params.messages, systemPrompt);
  let finalResponse = '';
  let iterations = 0;
  const toolCallsLog: Array<{ tool: string; result: unknown }> = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    const result = await callNvidiaChat({
      apiKey: env.NVIDIA_API_KEY,
      model,
      messages: oaiMessages,
      tools,
      onTextChunk: (chunk) => onEvent?.({ type: 'stream_chunk', content: chunk }),
    });

    oaiMessages = [...oaiMessages, result.assistantMessage];

    if (result.toolCalls.length === 0 || result.stopReason !== 'tool_calls') {
      finalResponse = result.text;
      break;
    }

    for (const tc of result.toolCalls) {
      onEvent?.({ type: 'tool_call', tool: tc.name, input: tc.input });

      let toolResult: unknown;
      let isError = false;
      try {
        if ('_raw_unparsed' in tc.input) {
          throw new Error(`Model produced invalid JSON arguments: ${tc.input._raw_unparsed}`);
        }
        toolResult = await executeTool(env, tc.name, tc.input);
      } catch (err) {
        toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
        isError = true;
      }

      toolCallsLog.push({ tool: tc.name, result: toolResult });
      onEvent?.({ type: 'tool_result', tool: tc.name, result: toolResult, isError });

      oaiMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
      });
    }

    if (iter === maxIterations - 2) {
      oaiMessages.push({
        role: 'user',
        content:
          'One tool-call round left. If the fix is not verified yet, stop and summarize status instead of rushing.',
      });
    }
  }

  return { finalResponse, toolCallsLog, iterations };
}
