// apps/ai-service/src/agent/modelCatalog.ts
//
// Single source of truth for user-selectable models. Both the /models
// endpoint (read by the frontend picker) and .github/workflows/model-watch.yml
// (which opens a PR editing this file when a watched family ships a new
// patch) point at THIS array — there's deliberately no second copy of
// model IDs anywhere else to drift out of sync.
//
// `watched: true` marks the three families you asked to track: the
// scheduled workflow probes build.nvidia.com for a newer patch of each and
// opens a PR bumping `modelId` + `label` here when one appears. Unwatched
// entries (Claude, DeepSeek, Qwen) are edited by hand when you want to
// change them.

export interface ModelCatalogEntry {
  id: string; // stable key, used in the WS protocol — do not change once shipped
  label: string; // shown in the picker UI
  provider: 'anthropic' | 'nvidia';
  modelId?: string; // NVIDIA model string; omitted for provider: 'anthropic'
  watched: boolean;
  notes?: string;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    provider: 'anthropic',
    watched: false,
    notes: 'Default. Most reliable for multi-step tool use.',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    provider: 'nvidia',
    modelId: 'deepseek-ai/deepseek-v4-pro',
    watched: false,
  },
  {
    id: 'qwen3.5-397b',
    label: 'Qwen3.5 397B',
    provider: 'nvidia',
    modelId: 'qwen/qwen3.5-397b-a17b',
    watched: false,
  },
  // ── Watched — kept current by model-watch.yml ────────────────────────────
  {
    id: 'glm',
    label: 'GLM 5.1',
    provider: 'nvidia',
    modelId: 'zhipuai/glm-5.1',
    watched: true,
  },
  {
    id: 'minimax',
    label: 'MiniMax M3',
    provider: 'nvidia',
    modelId: 'minimaxai/minimax-m3',
    watched: true,
  },
  {
    id: 'kimi',
    label: 'Kimi K2.5',
    provider: 'nvidia',
    modelId: 'moonshotai/kimi-k2.6',
    watched: true,
    notes: 'NVIDIA model IDs sometimes omit the minor version in the string itself — verify against the model card if a request 404s after a bump.',
  },
];

export function findModelEntry(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
