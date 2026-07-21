// apps/frontend/src/components/AIMenu/ModelPicker.tsx
//
// Fetches the model list from ai-service's /models endpoint rather than
// hardcoding it here — that endpoint reads modelCatalog.ts directly, which
// is the same file model-watch.yml's PRs update when a watched family
// (GLM/MiniMax/Kimi) ships a new patch. So the picker is current the
// moment a bump PR merges and redeploys — no separate frontend update.

import { useState, useEffect, useRef } from 'react';
import type { ModelSelection } from '../../lib/useHermesAgent';

const AI_URL = import.meta.env.VITE_AI_SERVICE_URL ?? 'https://hermes-ai.workers.dev';

interface CatalogEntry {
  id: string;
  label: string;
  provider: 'anthropic' | 'nvidia';
  modelId?: string;
  watched: boolean;
  notes?: string;
}

export function ModelPicker({ current, onChange }: { current: ModelSelection; onChange: (m: ModelSelection) => void }) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${AI_URL}/models`)
      .then((r) => r.json())
      .then((d: { models: CatalogEntry[] }) => setCatalog(d.models))
      .catch(() => setCatalog([{ id: 'claude', label: 'Claude (Anthropic)', provider: 'anthropic', watched: false }]));
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeEntry = catalog.find((m) =>
    m.provider === current.provider && (m.provider === 'anthropic' || m.modelId === current.nvidiaModelId),
  ) ?? catalog[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#0f1923', border: '1px solid #1e2a36', borderRadius: 3,
          padding: '3px 8px', color: '#8aa4b8', fontFamily: 'inherit', fontSize: 10,
          letterSpacing: 0.5, cursor: 'pointer',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: current.provider === 'anthropic' ? '#f0a868' : '#4ade80' }} />
        {activeEntry?.label ?? '…'}
        <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
          background: '#0a0e16', border: '1px solid #1a2535', borderRadius: 6,
          minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          {catalog.map((m) => {
            const isActive = m.id === activeEntry?.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  onChange({ provider: m.provider, nvidiaModelId: m.modelId });
                  setOpen(false);
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%',
                  background: isActive ? '#101c2c' : 'transparent', border: 'none',
                  borderBottom: '1px solid #111a24', padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isActive ? '#c8d3e0' : '#7a94a8' }}>
                  {m.label}
                  {m.watched && (
                    <span style={{ fontSize: 8, color: '#4ade80', border: '1px solid #1a4a28', borderRadius: 2, padding: '0 4px', letterSpacing: 0.5 }}>
                      AUTO-UPDATE
                    </span>
                  )}
                  {isActive && <span style={{ marginLeft: 'auto', color: '#00ffb4' }}>✓</span>}
                </span>
                {m.modelId && (
                  <span style={{ fontSize: 9, color: '#2a3a4a', marginTop: 2 }}>{m.modelId}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
