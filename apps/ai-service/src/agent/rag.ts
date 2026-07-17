// apps/ai-service/src/agent/rag.ts
// RAG pipeline: ingest text into Vectorize, query for relevant context

import type { Env } from '../index';

const EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5';
const CHUNK_SIZE_CHARS = 2048;  // ~512 tokens
const CHUNK_OVERLAP_CHARS = 256;
const MIN_RAG_SCORE = 0.45;

// ─────────────────────────────────────────────
// Ingest
// ─────────────────────────────────────────────

export async function ingestDocument(
  env: Env,
  text: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const chunks = chunkText(text, CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS);
  const docId = (metadata.id as string) ?? crypto.randomUUID();

  const BATCH = 10;
  for (let b = 0; b < chunks.length; b += BATCH) {
    const batch = chunks.slice(b, b + BATCH);
    const embResult = await env.AI.run(EMBEDDING_MODEL, { text: batch });

    const vectors = batch.map((chunk, i) => ({
      id: `${docId}-c${b + i}`,
      values: embResult.data[b + i] ?? embResult.data[i],
      metadata: {
        ...metadata,
        text: chunk,
        chunkIndex: b + i,
        totalChunks: chunks.length,
        docId,
      },
    }));

    await env.VECTORIZE.upsert(vectors);
  }
}

// ─────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────

export async function queryRAG(
  env: Env,
  query: string,
  topK = 5,
): Promise<string[]> {
  try {
    const embResult = await env.AI.run(EMBEDDING_MODEL, { text: [query] });
    const queryVector = embResult.data[0];

    const results = await env.VECTORIZE.query(queryVector, {
      topK,
      returnMetadata: 'all',
    });

    return results.matches
      .filter((m) => (m.score ?? 0) >= MIN_RAG_SCORE)
      .map((m) => m.metadata?.text as string)
      .filter(Boolean);
  } catch (err) {
    console.error('[RAG] query error:', err);
    return [];
  }
}

// ─────────────────────────────────────────────
// Chunking utility
// ─────────────────────────────────────────────

function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start += size - overlap;
  }

  return chunks.filter((c) => c.length > 40);
}
