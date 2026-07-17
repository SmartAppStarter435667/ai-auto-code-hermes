// apps/ai-service/src/agent/agenticLoop.ts
//
// The core tool-calling loop, extracted so it has exactly one implementation
// shared by:
//   - HermesAgent (interactive WebSocket chat)
//   - ciFix.ts (one-shot, unattended CI autofix runs)
//
// Previously this lived as a private method on HermesAgent, hard-wired to
// `connection.send`. That's fine for a Durable Object with a live WebSocket,
// but ciFix.ts has no connection — it's a plain Worker fetch handler running
// once and returning a result. Rather than copy-pasting the loop (and having
// the two copies drift), callers now pass an `onEvent` callback; HermesAgent
// forwards events to its WebSocket, ciFix.ts just collects them.

import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../index';
import { executeTool } from '../tools/index';

export interface AgentLoopEvent {
  type: 'stream_chunk' | 'tool_call' | 'tool_result';
  content?: string;
  tool?: string;
  input?: unknown;
  result?: unknown;
  isError?: boolean;
}

export interface AgenticLoopParams {
  anthropic: Anthropic;
  env: Env;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  maxIterations?: number;
  model?: string;
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

    // Out of budget on the LAST allowed iteration: make sure the model knows
    // this round is its last chance to wrap up, rather than silently cutting
    // it off mid-plan next loop.
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
