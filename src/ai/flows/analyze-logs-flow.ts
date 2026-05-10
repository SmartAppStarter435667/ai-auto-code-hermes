'use server';
/**
 * @fileOverview デプロイログを分析し、トラブルシューティング案を提示する AI フロー。
 * Self-Healing Agent の中核。
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeLogsInputSchema = z.object({
  target: z.string().describe('デプロイターゲット (fly.io, cloudflare 等)'),
  logs: z.array(z.string()).describe('収集されたログのリスト'),
  repoName: z.string().describe('リポジトリ名'),
  language: z.string().default('Japanese'),
});
export type AnalyzeLogsInput = z.infer<typeof AnalyzeLogsInputSchema>;

const AnalyzeLogsOutputSchema = z.object({
  status: z.enum(['error', 'warning', 'info']).describe('ログの全体的な深刻度'),
  rootCause: z.string().describe('エラーの根本原因の特定'),
  solution: z.string().describe('具体的な解決策と修正手順'),
  technicalNotes: z.string().describe('技術的な詳細解説 (DNS設定、ネットワーク構成等)'),
  suggestions: z.array(z.string()).describe('再発防止のための提案'),
});
export type AnalyzeLogsOutput = z.infer<typeof AnalyzeLogsOutputSchema>;

const prompt = ai.definePrompt({
  name: 'analyzeLogsPrompt',
  input: { schema: AnalyzeLogsInputSchema },
  output: { schema: AnalyzeLogsOutputSchema },
  prompt: `あなたは最高レベルの SRE (Site Reliability Engineer) です。{{{target}}} へのデプロイ中に発生したログを分析し、開発者が直面している問題を解決してください。

### コンテキスト:
リポジトリ: {{{repoName}}}
ターゲット: {{{target}}}

### ログ内容:
{{#each logs}}
- {{{this}}}
{{/each}}

### ミッション:
1. ログの中からエラーの兆候を特定し、根本原因を {{{language}}} で解説してください。
2. DNSエラー (DNS_PROBE_POSSIBLE等) や接続エラーがある場合、{{{target}}} のネットワーク構成やパブリックIPの要件に触れてください。
3. 開発者が次に行うべき具体的なコマンドやコードの修正案を提示してください。

**重要: 回答は必ず {{{language}}} で記述し、技術的な正確性を保ってください。**`,
});

const analyzeLogsFlow = ai.defineFlow(
  {
    name: 'analyzeLogsFlow',
    inputSchema: AnalyzeLogsInputSchema,
    outputSchema: AnalyzeLogsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input, {
        model: 'googleai/gemini-3.1-flash-lite-preview'
      });
      return output!;
    } catch (e: any) {
      const { output } = await prompt(input, {
        model: 'googleai/gemini-2.5-flash'
      });
      return output!;
    }
  }
);

export async function analyzeDeploymentLogs(
  input: AnalyzeLogsInput
): Promise<AnalyzeLogsOutput> {
  return analyzeLogsFlow(input);
}
