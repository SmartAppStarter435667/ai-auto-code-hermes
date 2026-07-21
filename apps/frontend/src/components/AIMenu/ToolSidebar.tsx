// apps/frontend/src/components/AIMenu/ToolSidebar.tsx
import type { ToolEvent } from '../../lib/useHermesAgent';

export function ToolSidebar({ events, activeTools }: { events: ToolEvent[]; activeTools: ToolEvent[] }) {
  return (
    <div style={{
      width: 220, borderLeft: '1px solid #111a24', background: '#060810', padding: '10px 0',
      overflowY: 'auto', flexShrink: 0, fontFamily: '"JetBrains Mono", monospace',
      scrollbarWidth: 'thin', scrollbarColor: '#1a2535 transparent',
    }}>
      <div style={{ padding: '4px 12px 10px', fontSize: 10, color: '#2a4a5a', letterSpacing: 2, borderBottom: '1px solid #111a24' }}>
        TOOL TRACE
      </div>

      {[...events].reverse().map((ev, i) => (
        <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid #0d1520', opacity: i === 0 ? 1 : 0.6 - i * 0.04 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: ev.type === 'tool_call' ? '#facc15' : ev.isError ? '#f87171' : '#4ade80' }}>
              {ev.type === 'tool_call' ? '▶' : ev.isError ? '✗' : '✓'}
            </span>
            <span style={{ fontSize: 10, color: '#6a8aaa', letterSpacing: 0.5 }}>{ev.tool.replace(/_/g, '.')}</span>
          </div>
          {ev.result != null && (
            <div style={{ fontSize: 10, color: '#2a3a4a', maxHeight: 48, overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5 }}>
              {(typeof ev.result === 'string' ? ev.result : JSON.stringify(ev.result)).slice(0, 80)}…
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ContextPanel({ repo, branch, file, onClose }: { repo?: string; branch?: string; file?: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, background: '#060810',
      borderLeft: '1px solid #111a24', padding: 16, zIndex: 10,
      fontFamily: '"JetBrains Mono", monospace', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#2a4a5a', letterSpacing: 2 }}>PROJECT CONTEXT</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a6070', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
      </div>

      {[{ label: 'REPO', value: repo }, { label: 'BRANCH', value: branch }, { label: 'FILE', value: file }].map(({ label, value }) => (
        <div key={label}>
          <div style={{ fontSize: 9, color: '#1e3a4a', letterSpacing: 2, marginBottom: 4 }}>{label}</div>
          <div style={{ background: '#0d1520', border: '1px solid #1a2535', borderRadius: 4, padding: '6px 10px', fontSize: 11, color: value ? '#7abacc' : '#1e3040', wordBreak: 'break-all' }}>
            {value ?? '—'}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 'auto', fontSize: 10, color: '#1a2a3a', lineHeight: 1.7 }}>
        Context is automatically injected into every Hermes prompt.
        Drop a file anywhere to add it to the RAG knowledge base.
      </div>
    </div>
  );
}
