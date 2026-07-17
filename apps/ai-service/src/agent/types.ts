// apps/ai-service/src/agent/types.ts

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ProjectContext {
  repo?: string;       // "owner/repo"
  branch?: string;
  language?: string;
  files?: string[];    // recently viewed file paths
  workspaceId?: string; // active Daytona workspace
}

export interface AgentState {
  messages: ChatMessage[];
  userId: string;
  sessionId: string;
  projectContext: ProjectContext;
  lastActive: number;
}

export interface WSMessage {
  type:
    | 'chat'
    | 'ingest'
    | 'clear_memory'
    | 'set_context'
    | 'ping';
  userId?: string;
  sessionId?: string;
  content?: string;
  text?: string;
  metadata?: Record<string, unknown>;
  context?: Partial<ProjectContext>;
}

export interface MemoryResult {
  memory: string;
  score?: number;
}
