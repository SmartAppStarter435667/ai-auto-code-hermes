// apps/ai-service/src/agent/types.ts

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ProjectContext {
  repo?: string;
  branch?: string;
  language?: string;
  files?: string[];
  workspaceId?: string;
}

export interface ModelSelection {
  provider: 'anthropic' | 'nvidia';
  nvidiaModelId?: string;
}

export interface AgentState {
  messages: ChatMessage[];
  userId: string;
  sessionId: string;
  projectContext: ProjectContext;
  modelSelection?: ModelSelection; // unset -> falls back to env.AI_PROVIDER
  lastActive: number;
}

export interface WSMessage {
  type: 'chat' | 'ingest' | 'clear_memory' | 'set_context' | 'set_model' | 'ping';
  userId?: string;
  sessionId?: string;
  content?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  context?: Partial<ProjectContext>;
  model?: ModelSelection;
}

export interface MemoryResult {
  memory: string;
  score?: number;
}
