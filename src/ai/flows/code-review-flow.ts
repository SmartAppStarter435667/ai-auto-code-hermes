'use server';
/**
 * @fileOverview AIによるコードレビューフロー。クォータエラー時のフォールバック対応済み。
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CodeReviewInputSchema = z.object({
  fileName: z.string().describe('対象ファイル名'),
  code: z.string().describe('レビューするコード'),
  language: z.string().default('Japanese').describe('出力言語'),
});
export type CodeReviewInput = z.infer<typeof CodeReviewInputSchema>;

const ReviewCommentSchema = z.object({
  type: z.enum(['bug', 'security', 'refactor', 'style']).describe('コメントの種別'),
  comment: z.string().describe('フィードバック内容'),
  suggestion: z.string().optional().describe('改善後のコード案'),
});

const CodeReviewOutputSchema = z.object({
  overallSummary: z.string().describe('全体のコード評価サマリー'),
  comments: z.array(ReviewCommentSchema).describe('個別のレビューコメントリスト'),
});
export type CodeReviewOutput = z.infer<typeof CodeReviewOutputSchema>;

const prompt = ai.definePrompt({
  name: 'codeReviewPrompt',
  input: { schema: CodeReviewInputSchema },
  output: { schema: CodeReviewOutputSchema },
  prompt: `あなたはシニアエンジニアとして、建設的なフィードバックを提供してください。

### 対象ファイル: {{{fileName}}}
### コード内容:
\`\`\`
{{{code}}}
\`\`\`

### レビューガイドライン:
1. 潜在的なバグやエッジケース。
2. セキュリティ上の脆弱性。
3. パフォーマンスの最適化。
4. 可読性と保守性の向上（リファクタリング）。

**重要: すべてのサマリーおよびコメントは必ず {{{language}}} で記述してください。**`,
});

const codeReviewFlow = ai.defineFlow(
  {
    name: 'codeReviewFlow',
    inputSchema: CodeReviewInputSchema,
    outputSchema: CodeReviewOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input, {
        model: 'googleai/gemini-3.1-flash-lite-preview'
      });
      return output!;
    } catch (e: any) {
      if (e.message?.includes('429') || e.message?.includes('quota') || e.message?.includes('responseMimeType')) {
        const { output } = await prompt(input, {
          model: 'googleai/gemini-2.5-flash'
        });
        return output!;
      }
      throw e;
    }
  }
);

export async function codeReview(input: CodeReviewInput): Promise<CodeReviewOutput> {
  return codeReviewFlow(input);
}
