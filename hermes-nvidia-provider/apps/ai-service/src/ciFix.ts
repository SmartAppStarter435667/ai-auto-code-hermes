// apps/ai-service/src/ciFix.ts
//
// Stage 3 entrypoint — CI Auto-Fix. Deliberately does NOT read
// env.AI_PROVIDER — this path writes directly to branches and opens PRs
// unattended, so it always uses Anthropic regardless of what the
// interactive chat is configured to use. NVIDIA's free-tier models are a
// reasonable cost/quality tradeoff for a conversation a human is watching
// live; they're a worse tradeoff for an agent whose tool calls go straight
// to git with nobody in the loop. Revisit this once the NVIDIA path has
// more real mileage on complex multi-step tool sequences.

import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import type { Env } from './index';
import { runAgenticLoop } from './agent/agenticLoop';
import { buildFixTools } from './tools/index';
import { buildCiFixSystemPrompt, buildCiFixTaskMessage, type CiFailureContext } from './agent/ciFixPrompt';

export interface CiFixRequest {
  repo: string;
  workflowName: string;
  jobName: string;
  stepName: string;
  branch: string;
  commitSha: string;
  runUrl: string;
  issueNumber: number;
  logExcerpt: string;
  baseBranch?: string;
}

const MAX_ITERATIONS = 15;

export async function handleCiFix(env: Env, req: CiFixRequest): Promise<Response> {
  if (!req.repo || !req.issueNumber || !req.commitSha) {
    return Response.json({ error: 'repo, issueNumber, and commitSha are required' }, { status: 400 });
  }

  const baseBranch = req.baseBranch ?? 'main';
  const ctx: CiFailureContext = { ...req, baseBranch };

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const systemPrompt = buildCiFixSystemPrompt(MAX_ITERATIONS, baseBranch);
  const taskMessage = buildCiFixTaskMessage(ctx);
  const tools = buildFixTools();

  const [owner, repo] = req.repo.split('/');
  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

  let loopResult: Awaited<ReturnType<typeof runAgenticLoop>>;
  try {
    loopResult = await runAgenticLoop({
      anthropic, env, systemPrompt,
      messages: [{ role: 'user', content: taskMessage }],
      tools, maxIterations: MAX_ITERATIONS,
      provider: 'anthropic', // see file header — always Anthropic here
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await octokit.issues.createComment({
      owner, repo, issue_number: req.issueNumber,
      body: `🤖 **Hermes CI Autofix — errored before completing**\n\n\`\`\`\n${message}\n\`\`\``,
    }).catch((commentErr) => console.error('[ci-fix] failed to post error comment:', commentErr));
    return Response.json({ error: message }, { status: 500 });
  }

  await octokit.issues.createComment({
    owner, repo, issue_number: req.issueNumber,
    body: `🤖 **Hermes CI Autofix**\n\n${loopResult.finalResponse}\n\n<sub>${loopResult.iterations}/${MAX_ITERATIONS} tool-call rounds used · ${loopResult.toolCallsLog.length} tool calls</sub>`,
  }).catch((err) => console.error('[ci-fix] failed to comment on issue:', err));

  return Response.json({
    finalResponse: loopResult.finalResponse,
    toolCallsLog: loopResult.toolCallsLog,
    iterations: loopResult.iterations,
  });
}
