export type ActivityType = 'upload' | 'commit' | 'ai' | 'repo-select' | 'repo-create' | 'file-create' | 'milestone-create' | 'error';

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: number;
  description: string;
  repoName?: string;
  fileName?: string;
  details?: string;
}

export interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp?: number;
  description?: string;
}

export interface PipelineState {
  id: string;
  repoName: string;
  status: 'idle' | 'running' | 'success' | 'failed' | 'interrupted';
  progress: number;
  currentStepId: string;
  startTime: number;
  elapsedTime: number;
  steps: PipelineStep[];
  type?: 'upload' | 'ai-pipeline' | 'milestone-flow';
  aiExplanation?: string;
  aiSuggestion?: string;
}

const STORAGE_KEY = 'cursor_app_activity';
const PIPELINE_KEY = 'cursor_app_pipeline_state';

export function logActivity(activity: Omit<Activity, 'id' | 'timestamp'>) {
  if (typeof window === 'undefined') return;
  
  // ユーザーのリクエストに従い、リポジトリを開いただけの履歴 (repo-select) を除外
  if (activity.type === 'repo-select') return;

  const activities = getActivities();
  const newActivity: Activity = {
    ...activity,
    id: Math.random().toString(36).substring(2, 11),
    timestamp: Date.now(),
  };
  
  const updated = [newActivity, ...activities].slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getActivities(): Activity[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

export function clearActivities() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PIPELINE_KEY);
}

export function savePipelineState(state: PipelineState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PIPELINE_KEY, JSON.stringify(state));
}

export function getPipelineState(): PipelineState | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(PIPELINE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (e) {
    return null;
  }
}

export function finishPipelineState() {
  if (typeof window === 'undefined') return;
  const state = getPipelineState();
  if (state) {
    const finishedSteps = state.steps.map(s => ({ ...s, status: 'completed' as const }));
    savePipelineState({
      ...state,
      status: 'success',
      progress: 100,
      steps: finishedSteps
    });
  }
}

export function clearPipelineState() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIPELINE_KEY);
}
