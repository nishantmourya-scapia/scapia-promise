import 'dotenv/config';
import { runPriceAgent } from './src/priceAgent.mjs';

export { runPriceAgent };

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  const productUrl = process.argv[2];
  if (!productUrl) {
    console.error('Usage: node index.mjs <product-url>');
    process.exit(1);
  }
  runPriceAgent(productUrl);
}
