import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Load environment variables for local development
import { config } from 'dotenv';
config();

/**
 * Initialize Genkit Instance with Advanced Models
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
