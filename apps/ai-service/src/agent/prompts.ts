// apps/ai-service/src/agent/prompts.ts
import type { ProjectContext } from './types';

interface PromptInput {
  memories: string[];
  ragContext: string[];
  projectContext: ProjectContext;
}

export function buildSystemPrompt({ memories, ragContext, projectContext }: PromptInput): string {
  const sections: string[] = [];

  sections.push(`\
You are **Hermes**, an autonomous AI coding agent built on Cloudflare.

Your capabilities:
• **Agentic code generation** — write, edit, refactor, debug production-grade code
• **GitHub operations** — browse repos, read/write files, manage issues, search code
• **Sandboxed execution** — run code safely in Daytona workspaces, get real output
• **Code analysis** — find bugs, security issues, performance bottlenecks
• **Long-term memory** — you remember past interactions with each user via mem0
• **RAG knowledge** — you retrieve project-specific context from a vector knowledge base

Agentic workflow (inspired by SWE-agent / OpenHands):
1. **Understand** — clarify the task before acting
2. **Plan** — break complex tasks into ordered tool calls
3. **Execute** — call tools iteratively, verify output at each step
4. **Verify** — run the code, check the result, fix errors automatically
5. **Report** — summarise what was done and what's next`);

  if (projectContext.repo || projectContext.workspaceId) {
    const ctx: string[] = ['## Active Project'];
    if (projectContext.repo) ctx.push(`Repository: \`${projectContext.repo}\``);
    if (projectContext.branch) ctx.push(`Branch: \`${projectContext.branch}\``);
    if (projectContext.language) ctx.push(`Primary language: ${projectContext.language}`);
    if (projectContext.workspaceId) ctx.push(`Daytona workspace: \`${projectContext.workspaceId}\``);
    if (projectContext.files?.length) {
      ctx.push(`Recently viewed:\n${projectContext.files.slice(0, 6).map(f => `  • ${f}`).join('\n')}`);
    }
    sections.push(ctx.join('\n'));
  }

  if (memories.length > 0) {
    sections.push(
      `## Long-term Memory (from mem0)\n${memories.slice(0, 12).map((m, i) => `${i + 1}. ${m}`).join('\n')}`,
    );
  }

  if (ragContext.length > 0) {
    sections.push(
      `## Retrieved Knowledge (RAG)\n${ragContext.map((c, i) => `### Chunk ${i + 1}\n${c}`).join('\n\n')}`,
    );
  }

  sections.push(
    'Always think step-by-step. Use tools to gather facts before writing code. Prefer complete, working solutions.',
  );

  return sections.join('\n\n');
}
