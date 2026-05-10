'use server';
/**
 * @fileOverview Universal Sandbox Forge: Generates production-grade infrastructure code.
 * Supports Cloudflare Gold architecture and Fly.io container configuration.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DeployInputSchema = z.object({
  repoName: z.string().describe('リポジトリ名'),
  projectType: z.string().describe('プロジェクト種別'),
  target: z.enum(['web', 'android', 'ios', 'desktop', 'server', 'cloudflare']).describe('ターゲット'),
  fileList: z.array(z.string()).describe('リポジトリのファイルリスト'),
});
export type DeployInput = z.infer<typeof DeployInputSchema>;

const DeployOutputSchema = z.object({
  workflowYaml: z.string().describe('生成されたGitHub Actions YAML'),
  terraformCode: z.string().optional().describe('TerraformによるIaC定義'),
  manifests: z.array(z.object({
    file: z.string().describe('設定ファイル名 (Dockerfile, fly.toml, wrangler.toml 等)'),
    content: z.string().describe('設定内容')
  })).optional().describe('ターゲット固有の追加設定ファイル'),
  instructions: z.string().describe('追加設定の手順（日本語）'),
  deploymentUrl: z.string().optional().describe('想定されるURL'),
});
export type DeployOutput = z.infer<typeof DeployOutputSchema>;

const prompt = ai.definePrompt({
  name: 'deployFlowPrompt',
  input: { 
    schema: DeployInputSchema.extend({
      isServer: z.boolean().describe('ターゲットが Fly.io かどうか'),
      isCloudflare: z.boolean().describe('ターゲットが Cloudflare かどうか')
    }) 
  },
  output: { schema: DeployOutputSchema },
  prompt: `あなたは Universal Sandbox Forge のリード DevOps アーキテクトです。

### ミッション:
提供されたプロジェクトを解析し、本番環境仕様（RAMSS: Reliability, Availability, Maintainability, Scalability, Security）で動作させるためのコンテナ設定および CI/CD 設定を生成してください。

{{#if isCloudflare}}
### Cloudflare Edge AI Platform (Gold Standard):
1. **Terraform**: Workers AI, D1, R2, KV, Durable Objects を定義。
2. **Wrangler**: wrangler.toml を生成し、Bindings を適切に設定。
3. **CI/CD**: Cloudflare Pages / Workers への自動デプロイ YAML。
{{/if}}

{{#if isServer}}
### Fly.io Container Forge:
1. **Dockerfile**: マルチステージビルドを採用した、Next.js/Node.js 用の最適化された設定。
2. **fly.toml**: 内部 DNS (.internal) とパブリックホストを統合。
3. **Terraform**: fly_app リソースの定義。
4. **CI/CD**: flyctl を用いたデプロイパイプライン。
{{/if}}

### ファイルリスト:
{{#each fileList}}
  - {{{this}}}
{{/each}}

回答は日本語で、具体的なコードブロック（特に manifests 配列）を充実させて提供してください。`,
});

const deployFlow = ai.defineFlow(
  {
    name: 'deployFlow',
    inputSchema: DeployInputSchema,
    outputSchema: DeployOutputSchema,
  },
  async (input) => {
    const isServer = input.target === 'server';
    const isCloudflare = input.target === 'cloudflare';
    
    try {
      const { output } = await prompt({
        ...input,
        isServer,
        isCloudflare
      }, {
        model: 'googleai/gemini-3.1-flash-lite-preview'
      });
      return output!;
    } catch (e: any) {
      const { output } = await prompt({
        ...input,
        isServer,
        isCloudflare
      }, {
        model: 'googleai/gemini-2.5-flash'
      });
      return output!;
    }
  }
);

export async function deployProject(input: DeployInput): Promise<DeployOutput> {
  return deployFlow(input);
}
