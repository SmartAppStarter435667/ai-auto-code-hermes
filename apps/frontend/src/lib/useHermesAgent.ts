// apps/frontend/src/lib/useHermesAgent.ts
import { useEffect, useRef, useState, useCallback } from 'react';

const AI_URL = import.meta.env.VITE_AI_SERVICE_URL ?? 'https://hermes-ai.workers.dev';

function toWsUrl(base: string, sessionId: string): string {
  const wsBase = base.replace(/^https?/, 'wss').replace(/^http$/, 'ws');
  return `${wsBase}/agents/HermesAgent/${encodeURIComponent(sessionId)}`;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatEntry {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: Array<{ tool: string; result: unknown }>;
}

// ── Status classification for the itemized progress UI ─────────────────────
// Mirrors the 読み込み中/書き込み中 pattern: each in-flight tool call gets a
// short verb + the specific target (file path, workspace name, query...) so
// the person watching sees *what* is being read/written, not just "working".

export type ToolStatusKind = 'reading' | 'writing' | 'creating' | 'running' | 'searching';

const STATUS_BY_TOOL: Record<string, ToolStatusKind> = {
  github_read_file: 'reading',
  github_list_files: 'reading',
  daytona_list_workspaces: 'reading',
  github_write_file: 'writing',
  github_create_branch: 'creating',
  github_create_pr: 'creating',
  github_create_issue: 'creating',
  daytona_create_workspace: 'creating',
  daytona_run_code: 'running',
  analyze_code: 'running',
  github_search_code: 'searching',
  github_get_commits: 'searching',
  github_list_issues: 'searching',
  rag_query: 'searching',
};

const STATUS_LABEL_JA: Record<ToolStatusKind, string> = {
  reading: '読み込み中',
  writing: '書き込み中',
  creating: '作成中',
  running: '実行中',
  searching: '検索中',
};

export function toolStatusKind(tool: string): ToolStatusKind {
  return STATUS_BY_TOOL[tool] ?? 'running';
}

export function toolStatusLabel(tool: string): string {
  return STATUS_LABEL_JA[toolStatusKind(tool)];
}

// Best-effort extraction of "what" is being acted on, for the pill label —
// e.g. github_read_file -> the path, daytona_create_workspace -> the name.
export function toolTargetLabel(tool: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  return (
    (i.path as string) ??
    (i.newBranch as string) ??
    (i.name as string) ??
    (i.title as string) ??
    (i.query as string) ??
    (i.repoUrl as string) ??
    tool.replace(/_/g, '.')
  );
}

export interface ToolEvent {
  type: 'tool_call' | 'tool_result';
  tool: string;
  input?: unknown;
  result?: unknown;
  isError?: boolean;
  timestamp: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseHermesAgentOptions {
  userId: string;
  sessionId: string;
  onToolEvent?: (event: ToolEvent) => void;
}

export interface ModelSelection {
  provider: 'anthropic' | 'nvidia';
  nvidiaModelId?: string;
}

const DEFAULT_MODEL: ModelSelection = { provider: 'anthropic' };

function loadStoredModel(userId: string): ModelSelection {
  if (typeof window === 'undefined') return DEFAULT_MODEL;
  try {
    const raw = localStorage.getItem(`hermes-model-${userId}`);
    return raw ? JSON.parse(raw) : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

interface UseHermesAgentReturn {
  messages: ChatEntry[];
  status: ConnectionStatus;
  isStreaming: boolean;
  isThinking: boolean; // true from send() until the first token/tool arrives
  activeTools: ToolEvent[]; // currently in-flight (tool_call without a matching tool_result yet)
  charsStreamedSoFar: number;
  currentModel: ModelSelection;
  send: (content: string) => void;
  ingest: (text: string, metadata?: Record<string, unknown>) => void;
  clearMemory: () => void;
  setContext: (context: Record<string, unknown>) => void;
  setModel: (model: ModelSelection) => void;
  clearMessages: () => void;
}

export function useHermesAgent({ userId, sessionId, onToolEvent }: UseHermesAgentOptions): UseHermesAgentReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolEvent[]>([]);
  const [charsStreamedSoFar, setCharsStreamedSoFar] = useState(0);
  const [currentModel, setCurrentModel] = useState<ModelSelection>(() => loadStoredModel(userId));

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    setStatus('connecting');
    const ws = new WebSocket(toWsUrl(AI_URL, sessionId));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Push whatever model was last chosen (or the persisted default) so
      // the Durable Object's state matches this session before the first
      // chat message goes out — otherwise the first message of every new
      // connection would silently use the server-side default instead.
      ws.send(JSON.stringify({ type: 'set_model', userId, model: loadStoredModel(userId) }));
    };
    ws.onerror = () => setStatus('error');
    ws.onclose = (e) => {
      setStatus('disconnected');
      if (e.code !== 1000 && e.code !== 1001) reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(event.data); } catch { return; }
      handleServerMessage(msg);
    };
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => {
      reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000);
    };
  }, [connect]);

  const handleServerMessage = useCallback((msg: Record<string, unknown>) => {
    switch (msg.type) {
      case 'stream_start': {
        const id = crypto.randomUUID();
        streamingIdRef.current = id;
        setIsStreaming(true);
        setIsThinking(true);
        setCharsStreamedSoFar(0);
        setMessages((prev) => [...prev, { id, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }]);
        break;
      }

      case 'stream_chunk': {
        const chunk = msg.content as string;
        setIsThinking(false); // first token arrived — no longer just "thinking"
        setCharsStreamedSoFar((n) => n + chunk.length);
        setMessages((prev) => prev.map((m) => (m.id === streamingIdRef.current ? { ...m, content: m.content + chunk } : m)));
        break;
      }

      case 'stream_end': {
        const toolCalls = msg.toolCallsLog as ChatEntry['toolCalls'];
        setMessages((prev) => prev.map((m) => (m.id === streamingIdRef.current ? { ...m, isStreaming: false, toolCalls } : m)));
        streamingIdRef.current = null;
        setIsStreaming(false);
        setIsThinking(false);
        setActiveTools([]);
        break;
      }

      case 'tool_call': {
        setIsThinking(false);
        const ev: ToolEvent = { type: 'tool_call', tool: msg.tool as string, input: msg.input, timestamp: Date.now() };
        setActiveTools((prev) => [...prev, ev]);
        onToolEvent?.(ev);
        break;
      }

      case 'tool_result': {
        const tool = msg.tool as string;
        setActiveTools((prev) => prev.filter((t) => t.tool !== tool));
        onToolEvent?.({ type: 'tool_result', tool, result: msg.result, isError: msg.isError as boolean, timestamp: Date.now() });
        break;
      }

      case 'error': {
        setIsStreaming(false);
        setIsThinking(false);
        setActiveTools([]);
        if (streamingIdRef.current) {
          setMessages((prev) => prev.map((m) => (m.id === streamingIdRef.current ? { ...m, isStreaming: false, content: m.content || `⚠️ ${msg.message}` } : m)));
          streamingIdRef.current = null;
        }
        break;
      }
      default: break;
    }
  }, [onToolEvent]);

  const rawSend = useCallback((data: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) { connect(); return; }
    wsRef.current.send(JSON.stringify(data));
  }, [connect]);

  const send = useCallback((content: string) => {
    if (!content.trim()) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content, timestamp: Date.now() }]);
    rawSend({ type: 'chat', userId, sessionId, content });
  }, [rawSend, userId, sessionId]);

  const ingest = useCallback((text: string, metadata?: Record<string, unknown>) => rawSend({ type: 'ingest', text, metadata }), [rawSend]);
  const clearMemory = useCallback(() => { rawSend({ type: 'clear_memory', userId }); setMessages([]); }, [rawSend, userId]);
  const setContext = useCallback((context: Record<string, unknown>) => rawSend({ type: 'set_context', context }), [rawSend]);
  const setModel = useCallback((model: ModelSelection) => {
    setCurrentModel(model);
    if (typeof window !== 'undefined') localStorage.setItem(`hermes-model-${userId}`, JSON.stringify(model));
    rawSend({ type: 'set_model', userId, model });
  }, [rawSend, userId]);
  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages, status, isStreaming, isThinking, activeTools, charsStreamedSoFar, currentModel,
    send, ingest, clearMemory, setContext, setModel, clearMessages,
  };
}
