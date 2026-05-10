'use server';
/**
 * @fileOverview プロフェッショナルな README.md を生成するフロー。
 * フォールバック対応済み。
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateReadmeInputSchema = z.object({
  name: z.string().describe('リポジトリ名'),
  description: z.string().optional().describe('リポジトリの説明'),
  projectType: z.string().describe('プロジェクト種別'),
  fileList: z.array(z.string()).describe('ファイルリスト'),
  language: z.string().default('Japanese').describe('出力言語'),
});
export type GenerateReadmeInput = z.infer<typeof GenerateReadmeInputSchema>;

const GenerateReadmeOutputSchema = z.object({
  readmeMarkdown: z.string().describe('生成されたREADME（Markdown）'),
});
export type GenerateReadmeOutput = z.infer<typeof GenerateReadmeOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateReadmePrompt',
  input: { schema: GenerateReadmeInputSchema },
  output: { schema: GenerateReadmeOutputSchema },
  prompt: `あなたはテクニカルライターです。プロジェクトの README.md を作成してください。

### プロジェクト情報:
- 名前: {{{name}}}
- 説明: {{{description}}}
- 種別: {{{projectType}}}
- 主要ファイル:
{{#each fileList}}
  - {{{this}}}
{{/each}}

### 要件:
1. 構成: タイトル、概要、主な機能、技術スタック、ディレクトリ構造、インストール方法。
2. 視覚的な補助として絵文字を使用すること。
3. 内容は必ず **{{{language}}}** で記述してください。`,
});

const generateReadmeFlow = ai.defineFlow(
  {
    name: 'generateReadmeFlow',
    inputSchema: GenerateReadmeInputSchema,
    outputSchema: GenerateReadmeOutputSchema,
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

export async function generateReadme(input: GenerateReadmeInput): Promise<GenerateReadmeOutput> {
  return generateReadmeFlow(input);
}
