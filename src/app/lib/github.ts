export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string;
  updated_at?: string;
  default_branch?: string;
  homepage?: string; // GitHub homepage field
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  updated_at: string;
  user: {
    login: string;
  };
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  updated_at: string;
  user: {
    login: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
      name: string;
    };
  };
  author?: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected?: boolean;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

const GITHUB_API = 'https://api.github.com';

export async function fetchRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(`${GITHUB_API}/user/repos?sort=updated&per_page=100`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch repositories');
  return res.json();
}

/**
 * 最新の成功したデプロイメントURLを取得
 */
export async function fetchLatestDeployment(token: string, fullName: string): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${fullName}/deployments?per_page=1`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) return null;
    const deployments = await res.json();
    if (deployments.length === 0) return null;

    const statusRes = await fetch(`${GITHUB_API}/repos/${fullName}/deployments/${deployments[0].id}/statuses`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!statusRes.ok) return null;
    const statuses = await statusRes.json();
    const successStatus = statuses.find((s: any) => s.state === 'success');
    
    return successStatus?.environment_url || deployments[0].payload?.web_url || null;
  } catch (e) {
    return null;
  }
}

export async function createRepo(token: string, name: string, description: string, _ignoredIsPrivate: boolean = true): Promise<GitHubRepo> {
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description,
      private: true,
      auto_init: true,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create repository');
  }
  return res.json();
}

export async function fetchContents(token: string, fullName: string, path: string = '', ref?: string): Promise<GitHubContent[]> {
  const url = `${GITHUB_API}/repos/${fullName}/contents/${path}${ref ? `?ref=${ref}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch contents');
  return res.json();
}

export async function fetchFileContent(token: string, fullName: string, path: string, ref?: string): Promise<GitHubContent> {
  const url = `${GITHUB_API}/repos/${fullName}/contents/${path}${ref ? `?ref=${ref}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch file');
  return res.json();
}

export async function fetchIssues(token: string, fullName: string): Promise<GitHubIssue[]> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/issues?state=open&sort=updated`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch issues');
  return res.json();
}

export async function createIssue(token: string, fullName: string, title: string, body: string): Promise<GitHubIssue> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create issue');
  }
  return res.json();
}

export async function fetchPullRequests(token: string, fullName: string): Promise<GitHubPullRequest[]> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/pulls?state=open&sort=updated`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch pull requests');
  return res.json();
}

export async function fetchBranches(token: string, fullName: string): Promise<GitHubBranch[]> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/branches`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch branches');
  return res.json();
}

export async function fetchCommits(token: string, fullName: string, path: string = '', ref?: string, perPage: number = 1): Promise<GitHubCommit[]> {
  const url = `${GITHUB_API}/repos/${fullName}/commits?path=${path}&per_page=${perPage}${ref ? `&sha=${ref}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCommitDetails(token: string, fullName: string, sha: string): Promise<any> {
  const url = `${GITHUB_API}/repos/${fullName}/commits/${sha}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch commit details');
  return res.json();
}

export async function createCommit(token: string, fullName: string, path: string, message: string, content: string, sha?: string, branch?: string): Promise<any> {
  const base64Content = btoa(unescape(encodeURIComponent(content)));
  
  const body: any = {
    message,
    content: base64Content,
  };
  if (sha) body.sha = sha;
  if (branch) body.branch = branch;

  const res = await fetch(`${GITHUB_API}/repos/${fullName}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to commit changes');
  }
  return res.json();
}

export async function deleteFile(token: string, fullName: string, path: string, message: string, sha: string, branch?: string): Promise<any> {
  const body: any = {
    message,
    sha,
  };
  if (branch) body.branch = branch;

  const res = await fetch(`${GITHUB_API}/repos/${fullName}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to delete file');
  }
  return res.json();
}

export async function fetchWorkflowRuns(token: string, fullName: string): Promise<GitHubWorkflowRun[]> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/actions/runs?per_page=10`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.workflow_runs || [];
}