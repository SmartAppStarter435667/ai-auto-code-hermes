// apps/ai-service/src/tools/index.ts
import { Octokit } from '@octokit/rest';
import type { Env } from '../index';
import type { ProjectContext } from '../agent/types';
import type Anthropic from '@anthropic-ai/sdk';

const GITHUB_CREATE_PR: Anthropic.Tool = {
  name: 'github_create_pr',
  description:
    'Open a pull request from a branch you have already committed a fix to (via github_write_file). Use this as the last step, after verifying your fix.',
  input_schema: {
    type: 'object' as const,
    properties: {
      repo: { type: 'string', description: 'owner/repo' },
      title: { type: 'string' },
      body: { type: 'string', description: 'PR description — root cause, what changed, how verified' },
      head: { type: 'string', description: 'Branch containing the fix' },
      base: { type: 'string', default: 'main' },
      draft: { type: 'boolean', default: false },
    },
    required: ['repo', 'title', 'head'],
  },
};

const ALL_TOOLS: Anthropic.Tool[] = [
  {
    name: 'github_list_files',
    description: 'List files and directories inside a GitHub repository path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        path: { type: 'string', default: '' },
        branch: { type: 'string', default: 'main' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'github_read_file',
    description: 'Read the full content of a file from a GitHub repository.',
    input_schema: {
      type: 'object' as const,
      properties: { repo: { type: 'string' }, path: { type: 'string' }, branch: { type: 'string', default: 'main' } },
      required: ['repo', 'path'],
    },
  },
  {
    name: 'github_write_file',
    description: 'Create or update a file in a GitHub repository with an auto-commit. Provide full new file content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string' },
        message: { type: 'string' },
        branch: { type: 'string', default: 'main' },
      },
      required: ['repo', 'path', 'content', 'message'],
    },
  },
  {
    name: 'github_create_branch',
    description: 'Create a new branch from the current HEAD of an existing branch.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string' },
        newBranch: { type: 'string' },
        fromBranch: { type: 'string', default: 'main' },
      },
      required: ['repo', 'newBranch'],
    },
  },
  {
    name: 'github_search_code',
    description: 'Search for code patterns or identifiers within a repository.',
    input_schema: {
      type: 'object' as const,
      properties: { repo: { type: 'string' }, query: { type: 'string' } },
      required: ['repo', 'query'],
    },
  },
  {
    name: 'github_get_commits',
    description: 'Get recent commit history for a branch or file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string' },
        path: { type: 'string' },
        branch: { type: 'string', default: 'main' },
        limit: { type: 'number', default: 20 },
      },
      required: ['repo'],
    },
  },
  {
    name: 'github_create_issue',
    description: 'Create a new GitHub issue.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['repo', 'title'],
    },
  },
  {
    name: 'github_list_issues',
    description: 'List open issues in a repository.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
        limit: { type: 'number', default: 20 },
      },
      required: ['repo'],
    },
  },
  GITHUB_CREATE_PR,
  {
    name: 'daytona_run_code',
    description: 'Execute arbitrary code in a secure Daytona sandbox and return stdout/stderr.',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' },
        language: { type: 'string', enum: ['bash', 'python', 'javascript', 'typescript', 'ruby', 'go'] },
        workspaceId: { type: 'string' },
      },
      required: ['code', 'language'],
    },
  },
  {
    name: 'daytona_create_workspace',
    description: 'Create a new Daytona workspace from a GitHub repo, optionally at a specific commit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repoUrl: { type: 'string' },
        name: { type: 'string' },
        commitSha: { type: 'string' },
      },
      required: ['repoUrl'],
    },
  },
  {
    name: 'daytona_list_workspaces',
    description: 'List all active Daytona workspaces for this user.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'analyze_code',
    description: 'Perform deep analysis of a code snippet for bugs, security issues, performance, and style.',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' },
        language: { type: 'string' },
        focus: { type: 'string', enum: ['bugs', 'security', 'performance', 'style', 'all'], default: 'all' },
      },
      required: ['code'],
    },
  },
  {
    name: 'rag_query',
    description: 'Search the project knowledge base for relevant documentation, code patterns, or architecture decisions.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' }, topK: { type: 'number', default: 5 } },
      required: ['query'],
    },
  },
];

export function buildTools(_context: ProjectContext): Anthropic.Tool[] {
  return ALL_TOOLS;
}

export function buildFixTools(): Anthropic.Tool[] {
  const excluded = new Set(['github_create_issue', 'github_list_issues']);
  return ALL_TOOLS.filter((t) => !excluded.has(t.name));
}

export async function executeTool(
  env: Env,
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

  switch (toolName) {
    case 'github_list_files': {
      const [owner, repo] = (input.repo as string).split('/');
      const { data } = await octokit.repos.getContent({
        owner, repo, path: (input.path as string) ?? '', ref: (input.branch as string) ?? 'main',
      });
      if (Array.isArray(data)) return data.map((f) => ({ name: f.name, type: f.type, path: f.path, size: f.size }));
      return data;
    }

    case 'github_read_file': {
      const [owner, repo] = (input.repo as string).split('/');
      const { data } = await octokit.repos.getContent({
        owner, repo, path: input.path as string, ref: (input.branch as string) ?? 'main',
      });
      if ('content' in data && data.content) {
        const content = atob(data.content.replace(/\n/g, ''));
        return { path: data.path, content, sha: data.sha, size: data.size };
      }
      return { error: 'Not a file or no content' };
    }

    case 'github_write_file': {
      const [owner, repo] = (input.repo as string).split('/');
      const path = input.path as string;
      const branch = (input.branch as string) ?? 'main';
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
        if ('sha' in data) sha = data.sha;
      } catch { /* new file */ }
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner, repo, path,
        message: input.message as string,
        content: btoa(unescape(encodeURIComponent(input.content as string))),
        branch, ...(sha ? { sha } : {}),
      });
      return { commitSha: data.commit.sha, url: data.commit.html_url, message: `✅ Committed to ${owner}/${repo}/${path}` };
    }

    case 'github_create_branch': {
      const [owner, repo] = (input.repo as string).split('/');
      const fromBranch = (input.fromBranch as string) ?? 'main';
      const newBranch = input.newBranch as string;
      const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${fromBranch}` });
      try {
        await octokit.git.createRef({ owner, repo, ref: `refs/heads/${newBranch}`, sha: ref.object.sha });
        return { created: true, branch: newBranch, from: fromBranch, sha: ref.object.sha };
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 422) return { created: false, branch: newBranch, message: 'Branch already exists — reusing it.' };
        throw err;
      }
    }

    case 'github_search_code': {
      const { data } = await octokit.search.code({ q: `${input.query} repo:${input.repo}` });
      return data.items.slice(0, 10).map((item) => ({ path: item.path, url: item.html_url, score: item.score }));
    }

    case 'github_get_commits': {
      const [owner, repo] = (input.repo as string).split('/');
      const { data } = await octokit.repos.listCommits({
        owner, repo, sha: (input.branch as string) ?? 'main',
        path: input.path as string | undefined, per_page: Math.min((input.limit as number) ?? 20, 50),
      });
      return data.map((c) => ({
        sha: c.sha.slice(0, 8), message: c.commit.message.split('\n')[0],
        author: c.commit.author?.name, date: c.commit.author?.date,
      }));
    }

    case 'github_create_issue': {
      const [owner, repo] = (input.repo as string).split('/');
      const { data } = await octokit.issues.create({
        owner, repo, title: input.title as string,
        body: input.body as string | undefined, labels: input.labels as string[] | undefined,
      });
      return { number: data.number, url: data.html_url, title: data.title };
    }

    case 'github_list_issues': {
      const [owner, repo] = (input.repo as string).split('/');
      const { data } = await octokit.issues.listForRepo({
        owner, repo, state: (input.state as 'open' | 'closed' | 'all') ?? 'open',
        per_page: Math.min((input.limit as number) ?? 20, 50),
      });
      return data.map((i) => ({
        number: i.number, title: i.title, state: i.state, url: i.html_url,
        labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)), created_at: i.created_at,
      }));
    }

    case 'github_create_pr': {
      const [owner, repo] = (input.repo as string).split('/');
      const { data } = await octokit.pulls.create({
        owner, repo, title: input.title as string, body: (input.body as string) ?? '',
        head: input.head as string, base: (input.base as string) ?? 'main', draft: (input.draft as boolean) ?? false,
      });
      return { number: data.number, url: data.html_url, message: `✅ PR #${data.number} opened` };
    }

    case 'daytona_run_code': {
      const res = await fetch(`${env.DAYTONA_SERVER_URL}/api/toolbox/process/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.DAYTONA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: wrapCodeAsCommand(input.code as string, input.language as string),
          workspaceId: input.workspaceId, timeout: 30,
        }),
      });
      if (!res.ok) throw new Error(`Daytona execute error: ${res.status} ${await res.text()}`);
      return res.json();
    }

    case 'daytona_create_workspace': {
      const res = await fetch(`${env.DAYTONA_SERVER_URL}/api/workspace`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.DAYTONA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (input.name as string) ?? `hermes-${Date.now()}`,
          repositories: [{ url: input.repoUrl, ...(input.commitSha ? { commit: input.commitSha } : {}) }],
        }),
      });
      if (!res.ok) throw new Error(`Daytona workspace error: ${res.status} ${await res.text()}`);
      const ws = await res.json<{ id: string; name: string }>();
      return {
        workspaceId: ws.id, name: ws.name,
        previewUrl: `https://3000-${ws.id}.${new URL(env.DAYTONA_SERVER_URL).hostname}`,
        message: '✅ Workspace created',
      };
    }

    case 'daytona_list_workspaces': {
      const res = await fetch(`${env.DAYTONA_SERVER_URL}/api/workspace`, {
        headers: { Authorization: `Bearer ${env.DAYTONA_API_KEY}` },
      });
      if (!res.ok) throw new Error(`Daytona list error: ${res.status}`);
      return res.json();
    }

    case 'analyze_code': {
      const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as Parameters<Ai['run']>[0], {
        messages: [
          { role: 'system', content: `You are an expert code reviewer. Analyze ${input.language ?? 'code'} for ${input.focus ?? 'all'} issues. Format output as JSON with keys: issues (array of {severity, description, line?}), suggestions (array of strings), overall_quality (1-10).` },
          { role: 'user', content: `\`\`\`${input.language ?? ''}\n${input.code}\n\`\`\`` },
        ],
        max_tokens: 2048,
      } as AiTextGenerationInput);
      return result;
    }

    case 'rag_query': {
      const { queryRAG } = await import('../agent/rag');
      const chunks = await queryRAG(env, input.query as string, (input.topK as number) ?? 5);
      return { query: input.query, results: chunks, count: chunks.length };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function wrapCodeAsCommand(code: string, language: string): string {
  const escapedCode = code.replace(/'/g, "'\\''");
  switch (language) {
    case 'python': return `python3 -c '${escapedCode}'`;
    case 'javascript': return `node -e '${escapedCode}'`;
    case 'typescript': return `npx ts-node -e '${escapedCode}'`;
    case 'ruby': return `ruby -e '${escapedCode}'`;
    case 'go': return `echo '${escapedCode}' | go run /dev/stdin`;
    default: return code;
  }
}
