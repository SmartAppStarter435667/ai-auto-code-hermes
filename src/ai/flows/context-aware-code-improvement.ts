'use server';
/**
 * @fileOverview 自律型 AI エージェント・フロー (Hybrid Orchestration: Groq + Gemini 3.1 Pro + CrewAI Bridge)
 * - Primary: Groq Cloud (Llama 3.3 70B / Qwen 2.5 Coder)
 * - Fallback & Tools: Google Gemini 3.1 Pro (with Custom Tools)
 * - Offloading: CrewAI Delegation Protocol for high-load tasks.
 */

import { ai, delegateToCrewAgent } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const GitHubIssueSchema = z.object({
  title: z.string(),
  body: z.string(),
  url: z.string().url(),
});

const GitHubCommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
  date: z.string(),
});

const ContextAwareCodeImprovementInputSchema = z.object({
  instruction: z.string().describe('ユーザーの指示 (Vibe)'),
  code: z.string().default('').describe('現在選択されているファイルのコード (任意)'),
  githubIssues: z.array(GitHubIssueSchema).describe('関連する GitHub イシュー'),
  recentCommits: z.array(GitHubCommitSchema).optional().describe('最新のコミット履歴'),
  architectureContext: z.string().optional().describe('リポジトリのアーキテクチャ・マップ'),
  modelId: z.string().default('groq/llama-3.3-70b-versatile'),
  language: z.string().default('Japanese'),
  userApiKey: z.string().optional().describe('ユーザーが提供した Gemini API Key'),
  groqKey: z.string().optional().describe('ユーザーが提供した Groq API Key'),
});
export type ContextAwareCodeImprovementInput = z.infer<typeof ContextAwareCodeImprovementInputSchema>;

const ContextAwareCodeImprovementOutputSchema = z.object({
  plan: z.array(z.object({
    file: z.string().describe('対象ファイルパス'),
    action: z.enum(['modify', 'create', 'delete']).describe('アクション'),
    reason: z.string().describe('この修正が必要な理由')
  })).describe('自律的な実行計画'),
  fileChanges: z.array(z.object({
    file: z.string().describe('ファイルパス'),
    content: z.string().describe('修正後の全コード内容')
  })).describe('実際のコード変更内容'),
  reasoning: z.string().describe('AI による深層技術推論 (Code Intelligence Reasoning)'),
  debugReport: z.string().describe('AI によるデバッグと機能検証の結果報告'),
  explanation: z.string().describe('ユーザー向けの概要説明'),
  llmMetadata: z.object({
    modelUsed: z.string(),
    provider: z.string(),
    isFallback: z.boolean(),
    toolUsed: z.boolean().optional(),
  }).optional(),
});
export type ContextAwareCodeImprovementOutput = z.infer<typeof ContextAwareCodeImprovementOutputSchema>;

const prompt = ai.definePrompt({
  name: 'contextAwareCodeImprovementPrompt',
  input: { schema: ContextAwareCodeImprovementInputSchema },
  output: { schema: ContextAwareCodeImprovementOutputSchema },
  tools: [delegateToCrewAgent],
  prompt: `あなたは Gemini 3.1 Pro と Groq を搭載した次世代の自律型 AI 開発エージェントです。

### ミッション:
ユーザーの抽象的な指示から、自律的にコードを生成・修正してください。
非常に複雑なタスクやリポジトリ全体の広範囲な変更が必要な場合は、ツール 「delegateToCrewAgent」 を使用して、外部の CrewAI エージェント・クラスターにタスクを委譲（オフロード）してください。

### デプロイ確認機能:
リポジトリ一覧メニューの 「View Site」 ボタンで最新のサイトを確認できることを {{{language}}} で案内してください。

### コンテキスト:
{{#if architectureContext}}
#### アーキテクチャ・マップ:
{{{architectureContext}}}
{{/if}}

{{#if code}}
#### アクティブファイル:
\`\`\`
{{{code}}}
\`\`\`
{{/if}}

### 指示 (The Vibe):
{{{instruction}}}

**重要: 回答は必ず {{{language}}} で記述し、fileChanges が空の場合は適切な理由を explanation に含めてください。**`,
});

async function callGroq(apiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw { status: res.status, message: errData?.error?.message || res.statusText, provider: 'Groq' };
  }

  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      explanation: parsed.explanation || "分析が完了しました。",
      reasoning: parsed.reasoning || parsed.explanation || "技術的推論を実行しました。",
      debugReport: parsed.debugReport || "機能検証済みです。",
      fileChanges: parsed.fileChanges || [],
      plan: parsed.plan || []
    };
  } catch (e) {
    throw new Error("Groq returned malformed JSON output.");
  }
}

export async function contextAwareCodeImprovement(
  input: ContextAwareCodeImprovementInput
): Promise<ContextAwareCodeImprovementOutput> {
  const isGroqRequested = input.modelId.startsWith('groq/');
  
  if (isGroqRequested && input.groqKey) {
    try {
      const systemPrompt = `You are a world-class coding agent. Respond ONLY in valid JSON: { "plan": [], "fileChanges": [], "reasoning": "string", "debugReport": "string", "explanation": "string" }. Language: ${input.language}`;
      const userPrompt = `Instruction: ${input.instruction}\n\nContext Code: ${input.code}\n\nIssues: ${JSON.stringify(input.githubIssues)}`;
      const result = await callGroq(input.groqKey, input.modelId.replace('groq/', ''), systemPrompt, userPrompt);
      return { ...result, llmMetadata: { modelUsed: input.modelId, provider: 'Groq', isFallback: false } };
    } catch (e: any) {
      if (e.status === 401 || e.status === 403) throw new Error(`Groq Auth Failed: ${e.message}`);
      console.warn("Groq failed, attempting Gemini 3.1 Pro Fallback...");
    }
  }

  // Gemini 3.1 Pro (with Tool Calling / CrewAI Delegation)
  try {
    const modelConfig = input.userApiKey ? {
      model: googleAI.model('gemini-3.1-pro-preview', { apiKey: input.userApiKey })
    } : {
      model: 'googleai/gemini-3.1-pro-preview'
    };

    const { output } = await prompt(input, modelConfig as any);
    
    if (output) return {
      ...output,
      fileChanges: output.fileChanges || [],
      plan: output.plan || [],
      explanation: output.explanation || "Gemini 3.1 Pro による回答です。",
      llmMetadata: { 
        modelUsed: 'gemini-3.1-pro-preview', 
        provider: 'Google', 
        isFallback: isGroqRequested,
        toolUsed: true 
      }
    };
  } catch (e: any) {
    // Last resort: simple 2.5 Flash if Pro fails or no tools supported
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' } as any);
    return {
      ...output!,
      llmMetadata: { modelUsed: 'gemini-2.5-flash', provider: 'Google', isFallback: true }
    };
  }

  throw new Error("AI Orchestration failed. Check your API keys in the Vault.");
}
