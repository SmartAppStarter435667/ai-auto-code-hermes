
/**
 * @fileOverview ユーザーのアプリ内操作を記録する軽量ロガー。
 * AI アシスタントがコンテキストとして使用します。
 */

export interface UserAction {
  timestamp: number;
  type: 'navigation' | 'action' | 'error';
  detail: string;
  metadata?: any;
}

let actionHistory: UserAction[] = [];
const MAX_HISTORY = 20;

export function logUserAction(action: Omit<UserAction, 'timestamp'>) {
  if (typeof window === 'undefined') return;
  
  const newAction: UserAction = {
    ...action,
    timestamp: Date.now(),
  };

  actionHistory = [newAction, ...actionHistory].slice(0, MAX_HISTORY);
  
  // 保存してページリロード後も AI が文脈を追えるようにする
  localStorage.setItem('ca_interaction_logs', JSON.stringify(actionHistory));
}

export function getUserInteractionLogs(): UserAction[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('ca_interaction_logs');
  if (!stored) return actionHistory;
  try {
    return JSON.parse(stored);
  } catch (e) {
    return actionHistory;
  }
}

export function clearInteractionLogs() {
  actionHistory = [];
  localStorage.removeItem('ca_interaction_logs');
}
