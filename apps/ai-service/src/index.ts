/**
 * Hermes AI Service — Cloudflare Worker Entry Point
 * Routes requests to the HermesAgent Durable Object, plus the standalone
 * one-shot /ci-fix endpoint used by the CI Autopilot GitHub Action.
 */
import { routeAgentRequest } from 'agents';
import { HermesAgent } from './agent/HermesAgent';
import { handleCiFix, type CiFixRequest } from './ciFix';

export { HermesAgent };

export interface Env {
  HERMES_AGENT: AgentNamespace<HermesAgent>;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  ANTHROPIC_API_KEY: string;
  MEM0_API_KEY: string;
  GITHUB_TOKEN: string;
  DAYTONA_API_KEY: string;
  DAYTONA_SERVER_URL: string;
  GIT_SERVICE_URL: string;
  PREVIEW_SERVICE_URL: string;
  ALLOWED_ORIGINS: string;
  // Shared secret checked against the X-CI-Autopilot-Secret header on
  // POST /ci-fix. Without this, anyone who finds the Worker URL could
  // trigger arbitrarily many agent runs against your Anthropic bill.
  CI_AUTOPILOT_SECRET: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-User-Id, X-Session-Id, X-CI-Autopilot-Secret, Upgrade, Connection',
  'Access-Control-Max-Age': '86400',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return withCors(
        Response.json({ status: 'ok', service: 'hermes-ai-service', timestamp: new Date().toISOString() }),
      );
    }

    if (url.pathname === '/ingest' && request.method === 'POST') {
      try {
        const { text, metadata = {} } = await request.json<{ text: string; metadata?: Record<string, unknown> }>();
        const { ingestDocument } = await import('./agent/rag');
        await ingestDocument(env, text, metadata);
        return withCors(Response.json({ success: true, chunked: true }));
      } catch (err) {
        return withCors(Response.json({ error: String(err) }, { status: 500 }));
      }
    }

    // ── Stage 3: CI Auto-Fix webhook ─────────────────────────────────────
    // Called by .github/workflows/ci-autopilot.yml right after it creates
    // a new ci-failure issue. Runs the constrained autofix agent to
    // completion and returns its summary; the agent itself posts the
    // detailed comment on the issue as it finishes (see ciFix.ts).
    if (url.pathname === '/ci-fix' && request.method === 'POST') {
      const secret = request.headers.get('X-CI-Autopilot-Secret');
      if (!env.CI_AUTOPILOT_SECRET || secret !== env.CI_AUTOPILOT_SECRET) {
        return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));
      }
      try {
        const body = await request.json<CiFixRequest>();
        return withCors(await handleCiFix(env, body));
      } catch (err) {
        return withCors(Response.json({ error: String(err) }, { status: 500 }));
      }
    }

    // All /agents/* traffic (interactive chat) is routed by the agents SDK,
    // handling both HTTP and WebSocket upgrade requests.
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return withCors(agentResponse);
    }

    return withCors(new Response('Not Found', { status: 404 }));
  },
} satisfies ExportedHandler<Env>;
