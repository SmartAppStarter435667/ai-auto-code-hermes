// apps/frontend/src/components/AIMenu/ThinkingProgress.tsx
//
// Matches the reference pattern from the Base44 builder: while the agent
// works, show a live "Thinking..." state, then itemized rows as each file/
// resource is touched (読み込み中/書き込み中/作成中/実行中/検索中 + the
// specific target), plus a collapsible "planning next step" summary with a
// running character count. Kept in Hermes' own dark/phosphor aesthetic
// rather than copying Base44's light theme — it's the interaction pattern
// being borrowed, not the visual language.

import { useState, useEffect, useRef } from 'react';
import type { ToolEvent } from '../../lib/useHermesAgent';
import { toolStatusKind, toolStatusLabel, toolTargetLabel } from '../../lib/useHermesAgent';

const STATUS_COLOR: Record<string, string> = {
  reading: '#7dd3fc',
  writing: '#4ade80',
  creating: '#facc15',
  running: '#f472b6',
  searching: '#a78bfa',
};

const STATUS_ICON: Record<string, string> = {
  reading: '◐',
  writing: '◑',
  creating: '◎',
  running: '▸',
  searching: '◈',
};

function relativeTime(ts: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 5) return 'たった今';
  if (diffSec < 60) return `${diffSec}秒前`;
  const min = Math.floor(diffSec / 60);
  return `${min}分前`;
}

interface ThinkingProgressProps {
  isThinking: boolean;
  activeTools: ToolEvent[];
  completedTools: ToolEvent[]; // tool_result events accumulated during this turn
  streamedChars: number;
  isStreaming: boolean;
}

export function ThinkingProgress({
  isThinking, activeTools, completedTools, streamedChars, isStreaming,
}: ThinkingProgressProps) {
  const [planExpanded, setPlanExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  // Keep relative timestamps ("たった今" -> "1分前") live while this is visible.
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tickRef.current);
  }, []);

  if (!isThinking && activeTools.length === 0 && completedTools.length === 0) return null;

  const allRows = [...completedTools, ...activeTools].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      background: '#080e18', border: '1px solid #131e2e', borderRadius: 6,
      padding: '10px 12px', margin: '4px 0',
    }}>
      {/* Thinking header */}
      {isThinking && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#00ffb4',
            animation: 'pulse 1.1s ease-in-out infinite', flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: '#4a6070', letterSpacing: 1 }}>Thinking…</span>
        </div>
      )}

      {/* Itemized file/resource rows — 読み込み中 / 書き込み中 / ... */}
      {allRows.map((ev, i) => {
        const kind = toolStatusKind(ev.tool);
        const color = STATUS_COLOR[kind];
        const isDone = completedTools.some((c) => c.tool === ev.tool && c.timestamp === ev.timestamp) && ev.type === 'tool_result';
        const target = toolTargetLabel(ev.tool, ev.input);

        return (
          <div key={`${ev.tool}-${ev.timestamp}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 12, color, flexShrink: 0, width: 14, textAlign: 'center',
              opacity: isDone ? 0.5 : 1,
              animation: isDone ? 'none' : 'pulse 1.1s ease-in-out infinite',
            }}>
              {isDone ? '✓' : STATUS_ICON[kind]}
            </span>
            <span style={{ fontSize: 12, color: isDone ? '#2a4a5a' : '#5a7890', letterSpacing: 0.3, flexShrink: 0 }}>
              {toolStatusLabel(ev.tool)}
            </span>
            <span style={{
              background: '#0d1520', border: `1px solid ${isDone ? '#1a2535' : color + '40'}`,
              color: isDone ? '#3a5468' : '#c8d3e0',
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {target}
            </span>
          </div>
        );
      })}

      {/* Collapsible "planning next step" summary with running char count */}
      {isStreaming && streamedChars > 0 && (
        <div>
          <button
            onClick={() => setPlanExpanded((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#3a5468', fontSize: 11, padding: 0, fontFamily: 'inherit',
            }}
          >
            <span style={{
              display: 'inline-block', transition: 'transform 0.15s',
              transform: planExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>
              ›
            </span>
            次のステップを計画中…
            <span style={{ color: '#1e3040' }}>
              · {streamedChars > 1000 ? `${Math.round(streamedChars / 1000)}k文字` : `${streamedChars}文字`}
            </span>
          </button>
        </div>
      )}

      {allRows.length > 0 && (
        <div style={{ fontSize: 10, color: '#1a2a3a', marginTop: 2 }}>
          {relativeTime(allRows[allRows.length - 1].timestamp, now)}
        </div>
      )}
    </div>
  );
}
