import { createOpenAI } from '@ai-sdk/openai';

export const litellm = createOpenAI({
  baseURL: 'https://api.odyssey.scapia.in/v1',
  apiKey: process.env.API_KEY,
});
