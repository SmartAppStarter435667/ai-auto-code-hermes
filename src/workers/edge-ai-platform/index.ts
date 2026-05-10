
/**
 * @fileOverview Production-grade Edge AI Router for Multi-LLM Orchestration.
 * Enhancing RAMSS: Reliability, Availability, Maintainability, Scalability, Security.
 */

interface Env {
  AI_CACHE: KVNamespace;
  LOG_BUCKET: R2Bucket;
  METRICS: AnalyticsEngineDataset;
  SESSION_STORE: DurableObjectNamespace;
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
  MISTRAL_API_KEY: string;
  KIMI_API_KEY: string;
  QWEN_API_KEY: string;
  AI: any; // Cloudflare Workers AI
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // SECURITY: Simple Token Check (Replace with Zero Trust or JWT)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader && !url.pathname.includes('/public')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
      const body: any = await request.json();
      const { prompt, stream = false, preference = 'auto', userId = 'anonymous' } = body;

      if (!prompt) return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });

      // 1. SCALABILITY: Semantic Cache Check (KV)
      const cacheKey = await this.hashPrompt(prompt);
      const cachedResponse = await env.AI_CACHE.get(cacheKey);
      if (cachedResponse && preference !== 'fresh') {
        return new Response(cachedResponse, { 
          headers: { 'X-Cache': 'HIT', 'Content-Type': 'application/json' } 
        });
      }

      // 2. RELIABILITY & AVAILABILITY: Intelligent Routing with Fallback
      const modelStack = this.getRoutingStack(preference);
      let lastError: Error | null = null;

      for (const modelConfig of modelStack) {
        try {
          const aiResponse = await this.executeAI(modelConfig, prompt, env);
          const result = await aiResponse.json();
          
          if (result.error) throw new Error(result.error.message || 'AI Provider Error');

          // 3. MAINTAINABILITY: Async Logging & Metrics
          await this.logExecution(env, modelConfig, prompt, result, userId);
          
          // Save to Cache
          await env.AI_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });

          return new Response(JSON.stringify(result), { 
            headers: { 'X-Cache': 'MISS', 'Content-Type': 'application/json' } 
          });
        } catch (e: any) {
          lastError = e;
          console.warn(`Fallback: Model ${modelConfig.name} failed (${e.message}). Trying next...`);
          continue; // Try next model in stack
        }
      }

      return new Response(JSON.stringify({ 
        error: 'Service Temporarily Unavailable', 
        detail: 'All upstream models failed to respond correctly.' 
      }), { status: 503 });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: err.message }), { status: 500 });
    }
  },

  async hashPrompt(prompt: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(prompt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  getRoutingStack(preference: string) {
    const stacks: Record<string, any[]> = {
      'speed': [
        { provider: 'groq', name: 'llama3-70b-8192' },
        { provider: 'cloudflare', name: '@cf/meta/llama-3-8b-instruct' }
      ],
      'intelligence': [
        { provider: 'gemini', name: 'gemini-1.5-pro' },
        { provider: 'mistral', name: 'codestral-latest' }
      ],
      'auto': [
        { provider: 'groq', name: 'llama3-70b-8192' },
        { provider: 'gemini', name: 'gemini-1.5-flash' },
        { provider: 'cloudflare', name: '@cf/meta/llama-3-8b-instruct' }
      ]
    };
    return stacks[preference] || stacks['auto'];
  },

  async executeAI(config: any, prompt: string, env: Env) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout for Reliability

    try {
      switch (config.provider) {
        case 'gemini':
          return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.name}:generateContent?key=${env.GEMINI_API_KEY}`, {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
        case 'groq':
          return fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: config.name, messages: [{ role: 'user', content: prompt }] })
          });
        case 'cloudflare':
          const res = await env.AI.run(config.name, { prompt });
          return new Response(JSON.stringify(res));
        default:
          throw new Error('Unsupported provider');
      }
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async logExecution(env: Env, config: any, prompt: string, result: any, userId: string) {
    const logId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const logData = {
      id: logId,
      timestamp,
      userId,
      model: config.name,
      provider: config.provider,
      promptSnippet: prompt.slice(0, 100),
      status: 'success'
    };
    
    // Non-blocking observability
    env.LOG_BUCKET.put(`logs/${timestamp.split('T')[0]}/${logId}.json`, JSON.stringify(logData)).catch(console.error);
    
    // Real-time Analytics
    env.METRICS.writeDataPoint({
      blobs: [config.provider, config.name, userId],
      doubles: [1.0],
      indexes: [config.provider]
    });
  }
};
