import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Load environment variables for local development
import { config } from 'dotenv';
config();

/**
 * CrewAI Bridge Tool
 * Offloads heavy multi-agent orchestration to an external cluster.
 */
export const delegateToCrewAgent = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })]
}).defineTool(
  {
    name: 'delegateToCrewAgent',
    description: 'Delegates complex, high-load repository tasks (like full-stack refactoring) to a specialized CrewAI agentic cluster.',
    inputSchema: z.object({
      taskDescription: z.string().describe('The complex task to offload'),
      contextFiles: z.array(z.string()).describe('List of relevant files for the crew'),
    }),
    outputSchema: z.object({
      status: z.string(),
      result: z.string(),
      appliedChanges: z.array(z.object({ file: z.string(), content: z.string() })).optional(),
    }),
  },
  async (input) => {
    // Conceptual Bridge: In a production setup, this would call an external API (Python/CrewAI)
    // Here we simulate the hand-off response.
    return {
      status: 'offloaded',
      result: `CrewAI Cluster started processing: ${input.taskDescription}. Scaling external resources...`,
      appliedChanges: []
    };
  }
);

/**
 * Initialize Genkit Instance with Advanced Models
 * 
 * - Default Model: gemini-3.1-pro-preview (for Tool Calling & Heavy Reasoning)
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
      apiVersion: 'v1beta' 
    }),
  ],
  model: googleAI.model('gemini-3.1-pro-preview'),
});

export { z };
