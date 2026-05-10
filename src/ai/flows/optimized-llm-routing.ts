'use server';
/**
 * @fileOverview インテリジェントなLLMルーティングフロー。
 * クォータ制限に応じたフォールバックを搭載。
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OptimizedLlmRoutingInputSchema = z.object({
  userInstruction: z.string().describe('ユーザーの指示'),
  codingTask: z.enum(['bug-fix', 'refactoring', 'new-feature']).describe('タスクの種類'),
  codeContext: z.string().optional().describe('関連するコード'),
  issueDescription: z.string().optional().describe('イシューの説明'),
});
export type OptimizedLlmRoutingInput = z.infer<typeof OptimizedLlmRoutingInputSchema>;

const OptimizedLlmRoutingOutputSchema = z.object({
  generatedCode: z.string().describe('生成されたコード'),
  llmUsed: z.string().describe('使用されたモデル名'),
  reasoning: z.string().describe('技術的な推論'),
});
export type OptimizedLlmRoutingOutput = z.infer<typeof OptimizedLlmRoutingOutputSchema>;

const prompt = ai.definePrompt({
  name: 'optimizedLlmRoutingPrompt',
  input: { schema: OptimizedLlmRoutingInputSchema },
  output: { schema: OptimizedLlmRoutingOutputSchema },
  prompt: `あなたはエリートデベロッパーです。
タスク種別: {{{codingTask}}}
指示: {{{userInstruction}}}

{{#if codeContext}}
### 文脈コード:
\`\`\`
{{{codeContext}}}
\`\`\`
{{/if}}

{{#if issueDescription}}
### イシュー内容:
{{{issueDescription}}}
{{/if}}

上記に基づき、最適な解決策を提示してください。`,
});

const optimizedLlmRoutingFlow = ai.defineFlow(
  {
    name: 'optimizedLlmRoutingFlow',
    inputSchema: OptimizedLlmRoutingInputSchema,
    outputSchema: OptimizedLlmRoutingOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input, {
        model: 'googleai/gemini-3.1-flash-lite-preview'
      });
      return {
        generatedCode: output?.generatedCode || '',
        llmUsed: 'Gemini 3.1 Flash Lite',
        reasoning: output?.reasoning || 'No reasoning provided.',
      };
    } catch (e: any) {
      if (e.message?.includes('429') || e.message?.includes('quota') || e.message?.includes('responseMimeType')) {
        const { output } = await prompt(input, {
          model: 'googleai/gemini-2.5-flash'
        });
        return {
          generatedCode: output?.generatedCode || '',
          llmUsed: 'Gemini 2.5 Flash (Fallback)',
          reasoning: output?.reasoning || 'No reasoning provided.',
        };
      }
      throw e;
    }
  }
);

export async function optimizedLlmRouting(input: OptimizedLlmRoutingInput): Promise<OptimizedLlmRoutingOutput> {
  return optimizedLlmRoutingFlow(input);
}
