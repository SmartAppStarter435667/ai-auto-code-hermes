// apps/ai-service/src/agent/providers/nvidia.ts
//
// NVIDIA NIM (build.nvidia.com) provider — free-tier alternative to Claude
// for the agentic loop. Fully OpenAI-compatible at the wire level
// (https://integrate.api.nvidia.com/v1/chat/completions), verified against
// the live catalog and several independent setup guides as of July 2026:
//   - deepseek-ai/deepseek-v4-pro
//   - minimaxai/minimax-m3
//   - qwen/qwen3.5-397b-a17b        (confirmed directly on build.nvidia.com)
//   - moonshotai/kimi-k2            (K2.5 was the newest confirmed point
//                                     release found; K2.6 may already exist
//                                     — see NVIDIA_MODEL_ID note below)
//   - zhipuai/glm-5.1               (GLM-5.2 appeared July 2, 2026 — newer
//                                     than what was asked for; both are live)
//
// The catalog moves fast — "fresh drops land fast" is a direct property of
// this platform, not a one-off. Rather than hardcode one of these, the
// active model is env-driven (NVIDIA_MODEL_ID) so swapping to whatever's
// newest is a `wrangler secret put` away, not a code change.
//
// No official NVIDIA SDK exists for Workers; this is a small hand-rolled
// client over fetch() + manual SSE parsing rather than pulling in the full
// `openai` npm package for what's ultimately one endpoint.

import type Anthropic from '@anthropic-ai/sdk';

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Confirmed live and free on build.nvidia.com as of July 2026. Used only if
// env.NVIDIA_MODEL_ID isn't set.
export const DEFAULT_NVIDIA_MODEL = 'deepseek-ai/deepseek-v4-pro';

// ─── OpenAI-shape types (minimal — only what this file needs) ─────────────

export interface OAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface NvidiaChatResult {
  text: string;
  toolCalls: NormalizedToolCall[];
  assistantMessage: OAIMessage; // append this to history for the next turn
  stopReason: 'tool_calls' | 'stop' | 'length' | string;
}

// ─── Tool schema conversion (Anthropic.Tool -> OpenAI function tool) ──────

export function anthropicToolsToOpenAI(tools: Anthropic.Tool[]): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}> {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.input_schema,
    },
  }));
}

// ─── Message history conversion ────────────────────────────────────────────
// Covers exactly the shapes agenticLoop.ts actually produces: plain text
// turns, assistant tool_use blocks, and user-role tool_result blocks. Not a
// general-purpose Anthropic<->OpenAI converter.

export function anthropicMessagesToOpenAI(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
): OAIMessage[] {
  const out: OAIMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }

    // content is a block array
    const toolUseBlocks = m.content.filter(
      (b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use',
    );
    const toolResultBlocks = m.content.filter(
      (b): b is Anthropic.ToolResultBlockParam => b.type === 'tool_result',
    );
    const textBlocks = m.content.filter(
      (b): b is Anthropic.TextBlockParam => b.type === 'text',
    );

    if (toolUseBlocks.length > 0) {
      out.push({
        role: 'assistant',
        content: textBlocks.map((b) => b.text).join('') || null,
        tool_calls: toolUseBlocks.map((tu) => ({
          id: tu.id,
          type: 'function',
          function: { name: tu.name, arguments: JSON.stringify(tu.input) },
        })),
      });
      continue;
    }

    if (toolResultBlocks.length > 0) {
      for (const tr of toolResultBlocks) {
        out.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
        });
      }
      continue;
    }

    if (textBlocks.length > 0) {
      out.push({ role: m.role, content: textBlocks.map((b) => b.text).join('') });
    }
  }

  return out;
}

// ─── Streaming chat call ───────────────────────────────────────────────────

export async function callNvidiaChat(params: {
  apiKey: string;
  model: string;
  messages: OAIMessage[];
  tools: Anthropic.Tool[];
  onTextChunk?: (chunk: string) => void;
}): Promise<NvidiaChatResult> {
  const { apiKey, model, messages, tools, onTextChunk } = params;

  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: tools.length > 0 ? anthropicToolsToOpenAI(tools) : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      stream: true,
      temperature: 0.6,
      max_tokens: 8192,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`NVIDIA NIM error: ${res.status} ${await res.text()}`);
  }

  // Accumulate streamed tool_call fragments by index — OpenAI-shape
  // streaming sends `function.arguments` as partial JSON string chunks,
  // not one block, so each index's pieces must be concatenated before
  // parsing.
  const toolCallAccum = new Map<number, { id: string; name: string; args: string }>();
  let textAccum = '';
  let stopReason = 'stop';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep incomplete last line for next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;

      let parsed: {
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string | null;
        }>;
      };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue; // skip malformed chunk rather than aborting the whole stream
      }

      const choice = parsed.choices?.[0];
      if (!choice) continue;

      if (choice.delta?.content) {
        textAccum += choice.delta.content;
        onTextChunk?.(choice.delta.content);
      }

      if (choice.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const existing = toolCallAccum.get(tc.index) ?? { id: '', name: '', args: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          toolCallAccum.set(tc.index, existing);
        }
      }

      if (choice.finish_reason) stopReason = choice.finish_reason;
    }
  }

  const toolCalls: NormalizedToolCall[] = [];
  for (const [, tc] of toolCallAccum) {
    let input: Record<string, unknown> = {};
    try {
      input = tc.args ? JSON.parse(tc.args) : {};
    } catch {
      // Model produced malformed tool-call JSON. Open models are less
      // reliable than Claude at strict schema adherence — surface the raw
      // string rather than silently dropping the call, so the executor's
      // own error handling (and the model's next turn) can see what broke.
      input = { _raw_unparsed: tc.args };
    }
    toolCalls.push({ id: tc.id, name: tc.name, input });
  }

  const assistantMessage: OAIMessage = {
    role: 'assistant',
    content: textAccum || null,
    ...(toolCalls.length > 0
      ? {
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
        }
      : {}),
  };

  return {
    text: textAccum,
    toolCalls,
    assistantMessage,
    stopReason: toolCalls.length > 0 ? 'tool_calls' : stopReason,
  };
}
