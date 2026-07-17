// apps/ai-service/src/ciFix.ts
//
// Stage 3 entrypoint — CI Auto-Fix.
//
// Unlike HermesAgent (a Durable Object holding a live WebSocket + persisted
// chat state), this is a plain, stateless one-shot run: the ci-autopilot.yml
// workflow POSTs failure details here once per new issue, this function runs
// the agentic loop to completion, comments the result on the issue, and
// returns. No Durable Object involved — there's no ongoing session to keep
// alive, so a DO would only add cost and complexity here.

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
  const ctx: CiFailureContext = {
    repo: req.repo,
    workflowName: req.workflowName,
    jobName: req.jobName,
    stepName: req.stepName,
    branch: req.branch,
    commitSha: req.commitSha,
    runUrl: req.runUrl,
    issueNumber: req.issueNumber,
    logExcerpt: req.logExcerpt ?? '',
    baseBranch,
  };

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const systemPrompt = buildCiFixSystemPrompt(MAX_ITERATIONS, baseBranch);
  const taskMessage = buildCiFixTaskMessage(ctx);
  const tools = buildFixTools();

  const [owner, repo] = req.repo.split('/');
  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

  let loopResult: Awaited<ReturnType<typeof runAgenticLoop>>;
  try {
    loopResult = await runAgenticLoop({
      anthropic,
      env,
      systemPrompt,
      messages: [{ role: 'user', content: taskMessage }],
      tools,
      maxIterations: MAX_ITERATIONS,
      // No onEvent forwarding needed here — nobody is watching live. The
      // GitHub issue comment posted below is the record of what happened.
    });
  } catch (err) {
    // Even on a hard failure, leave a trail on the issue rather than failing
    // silently — an autofix system that fails quietly is worse than none.
    const message = err instanceof Error ? err.message : String(err);
    await octokit.issues
      .createComment({
        owner, repo, issue_number: req.issueNumber,
        body: `🤖 **Hermes CI Autofix — errored before completing**\n\n\`\`\`\n${message}\n\`\`\`\n\nThis was not a "couldn't verify a fix" stop — the agent run itself threw. Worth checking ai-service logs for this invocation.`,
      })
      .catch((commentErr) => console.error('[ci-fix] failed to post error comment:', commentErr));

    return Response.json({ error: message }, { status: 500 });
  }

  // Post the agent's own final summary as the audit trail on the issue.
  // The prompt's "definition of done" asks for a structured summary
  // (root cause / change / verification / PR link), so this is usually
  // enough context for a human to decide whether to review or dig deeper.
  await octokit.issues
    .createComment({
      owner, repo, issue_number: req.issueNumber,
      body: `🤖 **Hermes CI Autofix**\n\n${loopResult.finalResponse}\n\n<sub>${loopResult.iterations}/${MAX_ITERATIONS} tool-call rounds used · ${loopResult.toolCallsLog.length} tool calls</sub>`,
    })
    .catch((err) => console.error('[ci-fix] failed to comment on issue:', err));

  return Response.json({
    finalResponse: loopResult.finalResponse,
    toolCallsLog: loopResult.toolCallsLog,
    iterations: loopResult.iterations,
  });
}
