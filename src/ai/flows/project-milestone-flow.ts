'use server';
/**
 * @fileOverview プロジェクトの仕様書からマイルストーン・フローを自動生成する AI エージェント。
 * - analyzeProjectMilestones: 仕様書を解析し、マイルストーンとロードマップを生成。
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MilestoneSchema = z.object({
  id: z.string(),
  label: z.string().describe('マイルストーンのタイトル'),
  description: z.string().describe('このマイルストーンで達成すべき内容'),
  status: z.enum(['pending', 'running', 'completed', 'error']).default('pending'),
  targetDate: z.string().optional().describe('目標期日'),
});

const ProjectMilestoneInputSchema = z.object({
  specifications: z.string().describe('プロジェクト仕様書または設計書の内容'),
  repoName: z.string().describe('リポジトリ名'),
  language: z.string().default('Japanese'),
});
export type ProjectMilestoneInput = z.infer<typeof ProjectMilestoneInputSchema>;

const ProjectMilestoneOutputSchema = z.object({
  title: z.string().describe('プロジェクト名/フロータイトル'),
  milestones: z.array(MilestoneSchema).describe('生成されたマイルストーンのリスト'),
  aiExplanation: z.string().describe('現在の全体状況についてのAIによる解説'),
  aiSuggestion: z.string().describe('次にとるべきアクションへの具体的な提案'),
  reasoning: z.string().describe('AIがこのフローを策定した技術的根拠'),
});
export type ProjectMilestoneOutput = z.infer<typeof ProjectMilestoneOutputSchema>;

const prompt = ai.definePrompt({
  name: 'projectMilestonePrompt',
  input: { schema: ProjectMilestoneInputSchema },
  output: { schema: ProjectMilestoneOutputSchema },
  prompt: `あなたは超一流のプロジェクトマネージャー兼ソフトウェアアーキテクトです。提供された仕様書を解析し、開発を成功させるための「マイルストーン・フロー」を策定してください。

### プロジェクト情報:
- リポジトリ: {{{repoName}}}
- 仕様書/設計書:
{{{specifications}}}

### ミッション:
1. プロジェクトを 5〜8 つの主要なマイルストーンに分解してください。
2. 各マイルストーンには、開発者が何をすべきか具体的な説明をつけてください。
3. **AI Explanation**: 現在のプロジェクトの全体像を俯瞰した要約を提供してください。
4. **AI Suggestion**: 開発者が「まず最初に手をつけるべきファイルやタスク」を具体的に提案してください。

**重要: すべての解説および提案は必ず {{{language}}} で記述してください。コードブロックには標準のマークダウンを使用してください。**`,
});

export async function analyzeProjectMilestones(input: ProjectMilestoneInput): Promise<ProjectMilestoneOutput> {
  const milestoneFlow = ai.defineFlow(
    {
      name: 'analyzeProjectMilestonesFlow',
      inputSchema: ProjectMilestoneInputSchema,
      outputSchema: ProjectMilestoneOutputSchema,
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
  return milestoneFlow(input);
}
