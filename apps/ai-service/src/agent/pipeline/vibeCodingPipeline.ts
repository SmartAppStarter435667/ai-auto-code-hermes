// apps/ai-service/src/agent/pipeline/vibeCodingPipeline.ts
//
// spec-kit's core idea, adapted: rough instructions -> spec -> plan ->
// implementation, as explicit stages rather than one prompt trying to do
// everything at once. Each stage reuses runAgenticLoop with a different
// pattern (patterns/index.ts) and tool set — no new execution engine, just
// the existing loop called four times with different framing.
//
// design.md is folded into the plan stage rather than being a separate
// pipeline stage: the plan prompt is instructed to make "create/update
// DESIGN.md" the first implementation task whenever the target repo has UI
// work and no DESIGN.md yet. The actual file gets written with the same
// github_write_file tool everything else uses; linting/token export (the
// @google/design.md CLI) runs via daytona_run_code, since ai-service itself
// is a Worker with no npm/npx execution of its own.

import type Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../../index';
import { runAgenticLoop, type AgentLoopEvent, type AiProvider } from '../agenticLoop';
import { buildTools } from '../../tools/index';
import { buildSystemPrompt } from '../prompts';
import { getPattern } from '../patterns/index';
import type { ProjectContext } from '../types';

export interface VibeCodingPipelineParams {
  anthropic: Anthropic;
  env: Env;
  userRequest: string;
  projectContext: ProjectContext;
  memories: string[];
  ragContext: string[];
  provider?: AiProvider;
  nvidiaModelId?: string;
  onEvent?: (event: AgentLoopEvent & { stage?: PipelineStage }) => void;
}

export type PipelineStage = 'spec' | 'plan' | 'implement' | 'suggest';

export interface VibeCodingPipelineResult {
  spec: string;
  plan: string;
  implementationResponse: string;
  toolCallsLog: Array<{ tool: string; result: unknown }>;
  suggestions: Array<{ label: string; rationale: string }>;
}

const HAS_DESIGN_MD_HINT = `\
Before writing UI code: check whether the repo already has a DESIGN.md at
its root (github_read_file). If it doesn't and this task involves visible
UI, your first implementation task should be creating one — a short set of
color/typography/spacing tokens plus a sentence or two on the visual
direction (see https://github.com/google-labs-code/design.md for the
format). Then, if @google/design.md is usable in the environment, run
\`npx @google/design.md export --format css-tailwind DESIGN.md > theme.css\`
via daytona_run_code to turn it into something the UI code can actually
import — a DESIGN.md nobody reads is just an extra file. If one already
exists, read it and follow it; don't invent a second, conflicting palette.`;

async function runStage(params: {
  anthropic: Anthropic;
  env: Env;
  systemPrompt: string;
  userMessage: string;
  tools: Anthropic.Tool[];
  provider?: AiProvider;
  nvidiaModelId?: string;
  stage: PipelineStage;
  onEvent?: VibeCodingPipelineParams['onEvent'];
  maxIterations?: number;
}): Promise<{ text: string; toolCallsLog: Array<{ tool: string; result: unknown }> }> {
  const { stage, onEvent } = params;
  const result = await runAgenticLoop({
    anthropic: params.anthropic,
    env: params.env,
    systemPrompt: params.systemPrompt,
    messages: [{ role: 'user', content: params.userMessage }],
    tools: params.tools,
    provider: params.provider,
    nvidiaModelId: params.nvidiaModelId,
    maxIterations: params.maxIterations ?? (params.tools.length > 0 ? 12 : 1),
    onEvent: onEvent ? (e) => onEvent({ ...e, stage }) : undefined,
  });
  return { text: result.finalResponse, toolCallsLog: result.toolCallsLog };
}

export async function runVibeCodingPipeline(
  params: VibeCodingPipelineParams,
): Promise<VibeCodingPipelineResult> {
  const { anthropic, env, userRequest, projectContext, memories, ragContext, provider, nvidiaModelId, onEvent } = params;

  // ── Stage 1: Spec (no tools — pure extraction from the request) ─────────
  const specStage = await runStage({
    anthropic, env, provider, nvidiaModelId, onEvent,
    stage: 'spec',
    systemPrompt: getPattern('extract_spec').systemPrompt,
    userMessage: userRequest,
    tools: [],
  });
  const spec = specStage.text;

  // ── Stage 2: Plan (no tools — but sees the spec + design.md guidance) ───
  const planStage = await runStage({
    anthropic, env, provider, nvidiaModelId, onEvent,
    stage: 'plan',
    systemPrompt: `${getPattern('extract_plan').systemPrompt}\n\n${HAS_DESIGN_MD_HINT}`,
    userMessage: `## Spec\n${spec}\n\n## Project context\nRepo: ${projectContext.repo ?? '(none — new project)'}\nBranch: ${projectContext.branch ?? 'main'}`,
    tools: [],
  });
  const plan = planStage.text;

  // ── Stage 3: Implement (full tool set — this is the existing agent loop) ─
  const implementSystemPrompt = buildSystemPrompt({ memories, ragContext, projectContext }) + `

## Spec (from the planning stage — treat as agreed scope, not open for renegotiation)
${spec}

## Plan (from the planning stage — follow this order; deviate only if you hit something the plan didn't anticipate, and say so)
${plan}`;

  const implementStage = await runStage({
    anthropic, env, provider, nvidiaModelId, onEvent,
    stage: 'implement',
    systemPrompt: implementSystemPrompt,
    userMessage: userRequest,
    tools: buildTools(projectContext),
    maxIterations: 20, // building a full app plausibly needs more rounds than a quick chat fix
  });

  // ── Stage 4: Suggestions (no tools — the "recommended features" UX) ─────
  const suggestStage = await runStage({
    anthropic, env, provider, nvidiaModelId, onEvent,
    stage: 'suggest',
    systemPrompt: getPattern('suggest_next_features').systemPrompt,
    userMessage: `## Spec\n${spec}\n\n## What was implemented\n${implementStage.text}`,
    tools: [],
  });

  let suggestions: Array<{ label: string; rationale: string }> = [];
  try {
    const parsed = JSON.parse(suggestStage.text);
    if (Array.isArray(parsed)) suggestions = parsed;
  } catch {
    // Model didn't return clean JSON — an empty suggestion list is a safe
    // fallback; this is a nice-to-have UX layer, not load-bearing.
  }

  return {
    spec,
    plan,
    implementationResponse: implementStage.text,
    toolCallsLog: implementStage.toolCallsLog,
    suggestions,
  };
}
