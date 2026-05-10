'use server';
/**
 * @fileOverview 自然言語の指示からコードを生成するフロー。
 * フォールバックロジック搭載。
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateCodeFromNaturalLanguageInputSchema = z.object({
  currentCode: z.string().describe('現在のコード内容'),
  instruction: z.string().describe('修正の指示'),
});
export type GenerateCodeFromNaturalLanguageInput = z.infer<typeof GenerateCodeFromNaturalLanguageInputSchema>;

const GenerateCodeFromNaturalLanguageOutputSchema = z.object({
  modifiedCode: z.string().describe('生成された修正後のコード'),
});
export type GenerateCodeFromNaturalLanguageOutput = z.infer<typeof GenerateCodeFromNaturalLanguageOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateCodeFromNaturalLanguagePrompt',
  input: { schema: GenerateCodeFromNaturalLanguageInputSchema },
  output: { schema: GenerateCodeFromNaturalLanguageOutputSchema },
  prompt: `あなたはエキスパートAIコーディングアシスタントです。指示に基づいてコードを修正してください。
修正後のコードのみを返し、解説やコードブロック記号は含めないでください。

現在のコード:
\`\`\`
{{{currentCode}}}
\`\`\`

指示: {{{instruction}}}

修正後のコード:
`,
});

const generateCodeFromNaturalLanguageFlow = ai.defineFlow(
  {
    name: 'generateCodeFromNaturalLanguageFlow',
    inputSchema: GenerateCodeFromNaturalLanguageInputSchema,
    outputSchema: GenerateCodeFromNaturalLanguageOutputSchema,
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

export async function generateCodeFromNaturalLanguage(
  input: GenerateCodeFromNaturalLanguageInput
): Promise<GenerateCodeFromNaturalLanguageOutput> {
  return generateCodeFromNaturalLanguageFlow(input);
}
