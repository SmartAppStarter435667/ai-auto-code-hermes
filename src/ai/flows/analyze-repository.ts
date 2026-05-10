'use server';
/**
 * @fileOverview DeepWiki (Cognition AI) and Atlas inspired repository analysis.
 * - architecture: Visualizes the project structure.
 * - knowledgeBase: Technical tutorial-style walkthrough for the codebase.
 * - reasoning: Actionable developer roadmap.
 * - healthScore: Projects a technical debt and security score.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeRepositoryInputSchema = z.object({
  name: z.string().describe('Repository name'),
  description: z.string().optional().describe('Repository description'),
  fileList: z.array(z.string()).describe('List of files in the repository'),
  language: z.string().default('Japanese').describe('Output language'),
});
export type AnalyzeRepositoryInput = z.infer<typeof AnalyzeRepositoryInputSchema>;

const AnalyzeRepositoryOutputSchema = z.object({
  analysis: z.string().describe('Deep technical analysis of the project state and tech stack'),
  architectureMap: z.string().describe('Visual ASCII or hierarchical map of the system architecture'),
  knowledgeBase: z.object({
    tutorial: z.string().describe('Step-by-step tutorial-style guide to understanding the code'),
    coreLogic: z.string().describe('Explanation of the most critical logic flows and data structures'),
    designDecisions: z.string().describe('Analysis of the architectural decisions found in the code'),
  }).describe('The Tutorial-Codebase-Knowledge component'),
  projectType: z.string().describe('Identified project category (e.g., Next.js, Mobile App)'),
  suggestions: z.array(z.string()).length(3).describe('3 specific, actionable developer tasks based on the current vibe'),
  healthScore: z.number().min(0).max(100).describe('Technical health score based on file structure and typical patterns'),
  securityAudit: z.string().describe('Brief security overview and potential risks detected in file names or structure'),
});
export type AnalyzeRepositoryOutput = z.infer<typeof AnalyzeRepositoryOutputSchema>;

const prompt = ai.definePrompt({
  name: 'analyzeRepositoryPrompt',
  input: { schema: AnalyzeRepositoryInputSchema },
  output: { schema: AnalyzeRepositoryOutputSchema },
  prompt: `You are an elite AI Architect inspired by Cognition AI's DeepWiki and Atlas. Your goal is to transform the provided file list into a comprehensive "Tutorial-Codebase-Knowledge" base.

### Repository Info:
Name: {{{name}}}
Description: {{{description}}}

### File Structure:
{{#each fileList}}
- {{{this}}}
{{/each}}

### Requirements for Tutorial-Codebase-Knowledge (DeepWiki Style):
1. **Analysis**: Deep dive into the technical stack. What is the "Vibe" of this code?
2. **Architecture Map**: Create a structured, hierarchical map of the system.
3. **Knowledge Base (The Core)**:
   - **Tutorial**: Write a technical walkthrough for a developer new to the repo. Where is the entry point? How does it scale?
   - **Core Logic**: Identify and explain the 3 most important files or logic flows.
   - **Design Decisions**: Why was it built this way? (e.g., "Uses App Router for performance", "Tailwind for rapid UI").
4. **Health Score & Security**:
   - Provide a numerical **healthScore** (0-100) reflecting technical debt and organization.
   - Summarize a **securityAudit** based on the file structure (e.g., missing .env, exposed configs).
5. **Suggestions**: Provide 3 "Vibe Coding" tasks the developer should implement next to improve or expand the system.

**CRITICAL: All output must be in {{{language}}}. Use standard markdown formatting for code blocks.**`,
});

const analyzeRepositoryFlow = ai.defineFlow(
  {
    name: 'analyzeRepositoryFlow',
    inputSchema: AnalyzeRepositoryInputSchema,
    outputSchema: AnalyzeRepositoryOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input, {
        model: 'googleai/gemini-3.1-flash-lite-preview'
      });
      return output!;
    } catch (e: any) {
      // Fallback for quota or unknown param errors
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

export async function analyzeRepository(
  input: AnalyzeRepositoryInput
): Promise<AnalyzeRepositoryOutput> {
  return analyzeRepositoryFlow(input);
}
