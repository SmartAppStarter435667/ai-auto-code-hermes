/**
 * @fileOverview 後方互換性のための Slack 通知ユーティリティ
 * 今後は notifications.ts の使用を推奨します。
 */
import { sendNotification } from './notifications';

export async function sendSlackNotification(message: string, details?: any) {
  return sendNotification(message, details);
}
