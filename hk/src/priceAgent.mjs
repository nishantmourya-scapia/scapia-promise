import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { litellm } from './llmClient.mjs';
import { fetchPageText } from './browser.mjs';
import { parseAgentResponse } from './responseParser.mjs';

const SYSTEM_PROMPT = `You extract the current purchase price (in INR) of a product from page text.
Respond with EXACTLY two lines, nothing else:
PRICE: <digits only, no currency symbol, no commas, no words; 0 if not found>
BASIS: <short phrase quoting or describing where on the page you found this price>

Ignore MSRP/strike-through prices, and ignore "people also bought"/recommended sections.`;

export async function runPriceAgent(productUrl) {
  let scrapedText = '';

  try {
    const { text } = await generateText({
      model: litellm.chat('claude-sonnet-5'),
      stopWhen: stepCountIs(3),

      system: SYSTEM_PROMPT,
      prompt: `Find the current price for the product at this URL: ${productUrl}`,

      tools: {
        fetchDynamicWebpageText: tool({
          description: 'Loads the product page in a headless browser and returns its rendered text.',
          inputSchema: z.object({
            url: z.string().url(),
          }),
          execute: async ({ url }) => {
            try {
              const pageText = await fetchPageText(url);
              scrapedText += ` ${pageText}`;
              return pageText;
            } catch (error) {
              return `Browser Script Error: ${error.message}`;
            }
          },
        }),
      },
    });

    const output = { ...parseAgentResponse(text, scrapedText), error: null };
    console.log(JSON.stringify(output));
    return output;

  } catch (error) {
    console.error(`Execution error: ${error.message}`);
    return { price: null, guardrail: 'error', basis: null, rawPrice: null, error: error.message };
  }
}
