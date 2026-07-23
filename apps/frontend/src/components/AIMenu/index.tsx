// apps/frontend/src/components/AIMenu/index.tsx
// Hermes AI Menu — Agentic RAG chat with long-term memory
// Loading-state UX (Thinking… -> itemized 読み込み中/書き込み中 rows ->
// collapsible planning summary) modeled on the Base44 builder reference,
// kept in Hermes' own dark/phosphor terminal aesthetic.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useHermesAgent, type ToolEvent, type ModelSelection } from '../../lib/useHermesAgent';
import { ToolSidebar } from './ToolSidebar';
import { ContextPanel } from './ContextPanel';
import { MessageBubble } from './MessageBubble';
import { ThinkingProgress } from './ThinkingProgress';
import { ModelPicker } from './ModelPicker';

interface AIMenuProps {
  userId: string;
  currentRepo?: string;
  currentBranch?: string;
  currentFile?: string;
}

export default function AIMenu({ userId, currentRepo, currentBranch, currentFile }: AIMenuProps) {
  const sessionId = useRef(
    typeof window !== 'undefined'
      ? (localStorage.getItem(`hermes-session-${userId}`) ?? (() => {
          const id = crypto.randomUUID();
          localStorage.setItem(`hermes-session-${userId}`, id);
          return id;
        })())
      : crypto.randomUUID(),
  ).current;

  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [turnCompletedTools, setTurnCompletedTools] = useState<ToolEvent[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [input, setInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleToolEvent = useCallback((e: ToolEvent) => {
    setToolEvents((prev) => [...prev.slice(-19), e]);
    if (e.type === 'tool_result') setTurnCompletedTools((prev) => [...prev, e]);
  }, []);

  const {
    messages, status, isStreaming, isThinking, activeTools, charsStreamedSoFar, currentModel, buildStage, suggestions,
    send, sendBuild, ingest, clearMemory, setContext, setModel, clearMessages,
  } = useHermesAgent({ userId, sessionId, onToolEvent: handleToolEvent });
  const [mode, setMode] = useState<'chat' | 'build'>('chat');

  useEffect(() => {
    if (status !== 'connected') return;
    setContext({ repo: currentRepo, branch: currentBranch, files: currentFile ? [currentFile] : [] });
  }, [status, currentRepo, currentBranch, currentFile, setContext]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeTools]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setTurnCompletedTools([]); // fresh progress list for this turn
    if (mode === 'build') sendBuild(trimmed); else send(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (label: string) => {
    if (isStreaming) return;
    setTurnCompletedTools([]);
    sendBuild(label);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.size > 500_000) continue;
      ingest(await file.text(), { filename: file.name, type: file.type });
    }
  }, [ingest]);

  const statusColor: Record<string, string> = { connected: '#4ade80', connecting: '#facc15', disconnected: '#6b7280', error: '#f87171' };
  const activeToolNames = activeTools.map((t) => t.tool);
  const lastMessage = messages[messages.length - 1];
  const showProgressOnLastMessage = lastMessage?.role === 'assistant' && lastMessage.isStreaming;

  return (
    <div
      className="ai-menu"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0c10', color: '#c8d3e0',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 13, position: 'relative', overflow: 'hidden',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,180,0.012) 3px, rgba(0,255,180,0.012) 4px)',
      }} />

      <Header
        status={status} statusColor={statusColor[status] ?? '#6b7280'} activeTools={activeToolNames}
        onClearMemory={clearMemory} onClearMessages={clearMessages} onToggleContext={() => setShowContext((v) => !v)}
        currentModel={currentModel} onModelChange={setModel}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'thin', scrollbarColor: '#1e2a36 transparent' }}>
          {messages.length === 0 && <EmptyState repo={currentRepo} />}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              extraContent={
                m.id === lastMessage?.id && showProgressOnLastMessage ? (
                  <ThinkingProgress
                    isThinking={isThinking}
                    activeTools={activeTools}
                    completedTools={turnCompletedTools}
                    streamedChars={charsStreamedSoFar}
                    isStreaming={isStreaming}
                  />
                ) : undefined
              }
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {toolEvents.length > 0 && <ToolSidebar events={toolEvents} activeTools={activeTools} />}
        {showContext && <ContextPanel repo={currentRepo} branch={currentBranch} file={currentFile} onClose={() => setShowContext(false)} />}
      </div>

      {dragOver && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,255,180,0.08)', border: '2px dashed #00ffb4', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ color: '#00ffb4', fontSize: 15, letterSpacing: 2 }}>DROP FILE → INGEST INTO KNOWLEDGE BASE</span>
        </div>
      )}

      {buildStage && (
        <div style={{
          padding: '4px 16px', fontSize: 10, color: '#00ffb4', letterSpacing: 1,
          background: '#080e18', borderTop: '1px solid #131e2e',
        }}>
          {{ spec: '📋 仕様を整理中…', plan: '🗺 計画を立案中…', implement: '⚡ 実装中…', suggest: '💡 次の提案を検討中…' }[buildStage]}
        </div>
      )}

      {suggestions.length > 0 && !isStreaming && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 16px 0', borderTop: '1px solid #1a2230', background: '#080a0e' }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(s.label)}
              title={s.rationale}
              style={{
                background: '#0a1510', border: '1px solid #1a4a28', color: '#4ade80',
                fontFamily: 'inherit', fontSize: 11, padding: '4px 10px', borderRadius: 12,
                cursor: 'pointer', letterSpacing: 0.3,
              }}
            >
              + {s.label}
            </button>
          ))}
        </div>
      )}

      <InputArea
        value={input} isStreaming={isStreaming} onChange={setInput} onKeyDown={handleKeyDown} onSubmit={handleSubmit} inputRef={inputRef}
        mode={mode} onModeChange={setMode}
      />
    </div>
  );
}

function Header({ status, statusColor, activeTools, onClearMemory, onClearMessages, onToggleContext, currentModel, onModelChange }: {
  status: string; statusColor: string; activeTools: string[];
  onClearMemory: () => void; onClearMessages: () => void; onToggleContext: () => void;
  currentModel: ModelSelection; onModelChange: (m: ModelSelection) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid #1a2230', background: '#080a0e', zIndex: 2 }}>
      <span style={{ color: '#00ffb4', fontWeight: 700, letterSpacing: 3, fontSize: 11 }}>HERMES</span>
      <span style={{ background: '#0f1923', border: '1px solid #1e2a36', padding: '2px 8px', borderRadius: 3, fontSize: 10, color: '#6b8aaa', letterSpacing: 1 }}>AGENTIC RAG</span>
      <div style={{ flex: 1 }} />
      <ModelPicker current={currentModel} onChange={onModelChange} />
      {activeTools.length > 0 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {activeTools.map((t) => (
            <span key={t} style={{ background: '#0d1f14', border: '1px solid #1a4a28', color: '#4ade80', padding: '2px 6px', borderRadius: 3, fontSize: 10, letterSpacing: 0.5, animation: 'pulse 1s infinite' }}>
              ⚡ {t.replace('_', '.')}
            </span>
          ))}
        </div>
      )}
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
      <span style={{ color: '#4a6070', fontSize: 10, letterSpacing: 1 }}>{status.toUpperCase()}</span>
      <button onClick={onToggleContext} title="Project context" style={btnStyle}>CTX</button>
      <button onClick={onClearMessages} title="Clear messages" style={btnStyle}>CLR</button>
      <button onClick={onClearMemory} title="Clear long-term memory" style={{ ...btnStyle, color: '#f87171' }}>MEM</button>
    </div>
  );
}

function EmptyState({ repo }: { repo?: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#2a3a4a', padding: 32, textAlign: 'center', gap: 12 }}>
      <span style={{ fontSize: 36, lineHeight: 1 }}>⬡</span>
      <span style={{ fontSize: 13, letterSpacing: 2, color: '#3a4a5a' }}>HERMES AGENT READY</span>
      <span style={{ fontSize: 11, color: '#2a3845', maxWidth: 320, lineHeight: 1.8 }}>
        {repo ? `Working on ${repo}. Ask me to read files, fix bugs, create issues, or run code.` : 'Ask me anything. Drop a file to ingest it into the knowledge base.'}
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
        {['Explain this file', 'Find bugs in selection', 'Create a GitHub issue', 'Run tests in Daytona', 'Refactor to TypeScript'].map((p) => (
          <span key={p} style={{ background: '#0d1520', border: '1px solid #1a2535', color: '#3a5878', padding: '4px 10px', borderRadius: 4, fontSize: 11, letterSpacing: 0.5 }}>{p}</span>
        ))}
      </div>
    </div>
  );
}

function InputArea({ value, isStreaming, onChange, onKeyDown, onSubmit, inputRef, mode, onModeChange }: {
  value: string; isStreaming: boolean; onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void; onSubmit: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  mode: 'chat' | 'build'; onModeChange: (m: 'chat' | 'build') => void;
}) {
  return (
    <div style={{ borderTop: '1px solid #1a2230', background: '#080a0e', padding: '8px 16px 10px', zIndex: 2 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {(['chat', 'build'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            disabled={isStreaming}
            style={{
              background: mode === m ? '#0d2a1f' : 'transparent',
              border: `1px solid ${mode === m ? '#1a4a28' : '#1a2535'}`,
              color: mode === m ? '#4ade80' : '#3a5468',
              fontFamily: 'inherit', fontSize: 10, padding: '3px 10px', borderRadius: 3,
              cursor: isStreaming ? 'not-allowed' : 'pointer', letterSpacing: 1,
            }}
          >
            {m === 'chat' ? '💬 CHAT' : '🏗 BUILD'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      <textarea
        ref={inputRef} value={value} disabled={isStreaming}
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
        placeholder={
          isStreaming ? '⌛ Hermes is thinking…'
          : mode === 'build' ? '🏗 Describe the app or feature to build — Hermes will spec, plan, then implement it'
          : '▸ Message Hermes — Shift+Enter for newline'
        }
        rows={1}
        style={{
          flex: 1, background: '#0d1520', border: '1px solid #1e2a36', color: '#c8d3e0', fontFamily: 'inherit',
          fontSize: 13, padding: '8px 12px', borderRadius: 4, resize: 'none', outline: 'none', lineHeight: 1.6,
          maxHeight: 120, opacity: isStreaming ? 0.5 : 1, transition: 'border-color 0.15s',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#00ffb4')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2a36')}
      />
      <button
        onClick={onSubmit} disabled={isStreaming || !value.trim()}
        style={{
          background: isStreaming ? '#0d1520' : '#00302050', border: `1px solid ${isStreaming ? '#1e2a36' : '#00ffb4'}`,
          color: isStreaming ? '#2a3a4a' : '#00ffb4', fontFamily: 'inherit', fontSize: 11, padding: '8px 14px',
          borderRadius: 4, cursor: isStreaming ? 'not-allowed' : 'pointer', letterSpacing: 2,
        }}
      >
        {isStreaming ? '…' : '↑ SEND'}
      </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #1e2a36', color: '#4a6070',
  fontFamily: 'inherit', fontSize: 10, padding: '3px 8px', borderRadius: 3, cursor: 'pointer', letterSpacing: 1,
};
