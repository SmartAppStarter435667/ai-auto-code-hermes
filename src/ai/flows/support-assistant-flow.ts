'use server';
/**
 * @fileOverview アプリ内操作をサポートするグローバル AI アシスタント。
 * アプリの全機能（Gemini Code Assist, Google CLI, Sandbox, Fly.io/Cloudflareデプロイ, ZIPインポート）を熟知しています。
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InteractionLogSchema = z.object({
  timestamp: z.number(),
  type: z.string(),
  detail: z.string(),
});

const SupportAssistantInputSchema = z.object({
  userMessage: z.string().describe('ユーザーからの質問'),
  interactionLogs: z.array(InteractionLogSchema).describe('直近のアプリ操作ログ'),
  currentTab: z.string().describe('現在開いているタブ'),
  language: z.string().default('Japanese'),
});

const SupportAssistantOutputSchema = z.object({
  reply: z.string().describe('ユーザーへの回答（マークダウン形式）'),
  suggestedAction: z.string().optional().describe('ユーザーに提案する具体的な次のアクション'),
  relevantMenu: z.enum(['repos', 'editor', 'ai', 'server', 'activity', 'settings']).optional().describe('案内すべきメニュー'),
});

const APP_DOCUMENTATION = `
### このアプリの機能ドキュメント (AIコンシェルジュ用)

1. **Gemini Code Assist (AIメニュー)**:
   - デフォルトで有効な自律型コーディングエンジン。
   - 高度な推論により、バグ修正から新規機能実装までを自動で行い、GitHubへ直接コミットします。
   - 修正中はファイル名、言語アイコン、Diff統計(+/-)、コードプレビューが表示されます。

2. **Google CLI (サーバー/AIメニュー)**:
   - 仮想ターミナルUI。コマンド('sync', 'deploy', 'analyze', 'status', 'help')を叩けます。
   - 'Sync All'機能では、Firebase Studio同様に"Pending the files"ステータスで全リポジトリコードをGitHubへ同期します。

3. **サーバー (旧実行環境)**:
   - Universal Sandbox Forgeを搭載。
   - Web, Fly.io, Cloudflare, Android へのデプロイをサポート。
   - デプロイ工程は「Workspaceの設定」「環境の初期設定」「環境のビルド」「デプロイ」の4ステップで進行。
   - エラー発生時は「ログ解析」ボタンでAI診断が可能。

4. **コード (エディタ)**:
   - リポジトリ内のファイルをMonaco Editorで編集・保存。
   - ZIPインポート機能：ZIPファイルをアップロードすると、自動解凍して新規リポジトリを作成し、GitHubへプッシュします。
   - 既存リポジトリへの「ZIP上書き展開」もサポート。

5. **履歴 (Activity)**:
   - アプリ内操作ログと、GitHubフィード（イシュー、PR、コミット、Actions履歴）を統合表示。
   - コミットの「Revert (元に戻す)」機能をサポート。

6. **設定 (Settings)**:
   - トラフィック解析（Analytics）ダッシュボード。
   - サブスクリプション管理（Free, Pro, Enterprise）。
`;

const prompt = ai.definePrompt({
  name: 'supportAssistantPrompt',
  input: { schema: SupportAssistantInputSchema },
  output: { schema: SupportAssistantOutputSchema },
  prompt: `あなたは このアプリの公式 AI コンシェルジュです。提供されたアプリドキュメントを熟知し、ユーザーの操作ログに基づいて最高のサポートを提供してください。

### アプリ仕様書:
${APP_DOCUMENTATION}

### コンテキスト:
- 現在のタブ: {{{currentTab}}}
- ユーザーの直近の操作ログ:
{{#each interactionLogs}}
  - [{{type}}] {{{detail}}}
{{/each}}

### ユーザーの質問:
{{{userMessage}}}

### ガイドライン:
1. ユーザーの操作ログを確認し、何に苦戦しているか（デプロイエラー、ファイルが見つからない等）を推測してください。
2. 簡潔かつ丁寧に、解決策や操作手順を {{{language}}} で説明してください。
3. もし特定のメニューに行く必要があるなら、そのメニュー名を明示してください。
4. ドキュメントに基づき、未実装の機能については正直に答えつつ、代わりの手段を提案してください。
5. 回答は親しみやすく、かつプロフェッショナルなトーンを保ってください。`,
});

const supportAssistantFlow = ai.defineFlow(
  {
    name: 'supportAssistantFlow',
    inputSchema: SupportAssistantInputSchema,
    outputSchema: SupportAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function askSupportAssistant(input: z.infer<typeof SupportAssistantInputSchema>) {
  return supportAssistantFlow(input);
}
