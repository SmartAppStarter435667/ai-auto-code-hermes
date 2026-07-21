#!/usr/bin/env node
// .github/scripts/check-model-updates.mjs
//
// Probes build.nvidia.com for newer patch versions of the three watched
// model families and writes findings to model-updates.json for the
// workflow to act on.
//
// Reliability note: NVIDIA's own docs confirm /v1/models for self-hosted,
// single-model NIM containers (http://localhost:8000/v1/models). Its
// behavior on the shared multi-model gateway (integrate.api.nvidia.com) —
// whether it lists the full public catalog — isn't independently confirmed
// as of when this was written. This script is written defensively because
// of that: any failure, unexpected shape, or empty result is logged and
// treated as "nothing to report" rather than crashing the workflow or,
// worse, reporting a false update. A silent no-op run is always the safe
// failure mode here.

import { readFile, writeFile } from 'fs/promises';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const CATALOG_PATH = 'apps/ai-service/src/agent/modelCatalog.ts';

const WATCHED_FAMILIES = [
  { id: 'glm', prefix: 'zhipuai/glm-' },
  { id: 'minimax', prefix: 'minimaxai/minimax-' },
  { id: 'kimi', prefix: 'moonshotai/kimi-' },
];

function parseVersion(modelId, prefix) {
  const rest = modelId.slice(prefix.length);
  const match = rest.match(/[\d.]+/);
  if (!match) return null;
  return match[0].split('.').map(Number);
}

function compareVersions(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchCatalogModelIds() {
  let res;
  try {
    res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${NVIDIA_API_KEY}` },
    });
  } catch (err) {
    console.warn('[model-watch] fetch failed — skipping this run:', err.message);
    return null;
  }

  if (!res.ok) {
    console.warn(`[model-watch] /v1/models returned ${res.status} — skipping this run`);
    return null;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    console.warn('[model-watch] response was not valid JSON — skipping this run');
    return null;
  }

  if (!Array.isArray(data?.data)) {
    console.warn('[model-watch] unexpected response shape (no data[] array) — skipping this run');
    return null;
  }

  const ids = data.data.map((m) => m?.id).filter(Boolean);
  if (ids.length === 0) {
    console.warn('[model-watch] response had zero usable model IDs — skipping this run');
    return null;
  }

  return ids;
}

async function main() {
  if (!NVIDIA_API_KEY) {
    console.warn('[model-watch] NVIDIA_API_KEY not set — skipping');
    await writeFile('model-updates.json', '[]');
    return;
  }

  const allModels = await fetchCatalogModelIds();
  if (!allModels) {
    await writeFile('model-updates.json', '[]');
    return;
  }

  const catalogSource = await readFile(CATALOG_PATH, 'utf8');
  const updates = [];

  for (const family of WATCHED_FAMILIES) {
    const candidates = allModels.filter((id) => id.startsWith(family.prefix));
    if (candidates.length === 0) continue;

    let best = null;
    let bestVersion = null;
    for (const id of candidates) {
      const v = parseVersion(id, family.prefix);
      if (!v) continue;
      if (!bestVersion || compareVersions(v, bestVersion) > 0) {
        best = id;
        bestVersion = v;
      }
    }
    if (!best) continue;

    // Current modelId recorded for this family's catalog entry
    const entryRegex = new RegExp(`id:\\s*'${family.id}'[\\s\\S]*?modelId:\\s*'([^']+)'`);
    const current = entryRegex.exec(catalogSource)?.[1];

    if (current && current !== best) {
      updates.push({ familyId: family.id, from: current, to: best });
    }
  }

  await writeFile('model-updates.json', JSON.stringify(updates, null, 2));
  console.log(`[model-watch] found ${updates.length} update(s):`, updates);
}

main().catch((err) => {
  // Never fail the workflow on a probe error — see file header.
  console.error('[model-watch] unexpected error, treated as no-op:', err);
});
