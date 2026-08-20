import { runPriceAgent } from './index.mjs';

// Regression suite: fixed golden set of URL -> expected current selling
// price (INR), ignoring any strikethrough/MRP price. Verified by hand on
// 2026-08-20; run after changing the prompt/model/scraping logic. Re-check
// ground truth if prices on these sites change and a case starts failing.
const CASES = [
  {
    url: 'https://troovyfoods.com/products/the-healthy-high-protein-instant-pasta',
    expected: 240,
    note: 'plain price, no MRP shown',
  },
  {
    url: 'https://troovyfoods.com/products/healthy-choco-spread-sale',
    expected: 359,
    note: 'sale price vs strikethrough MRP 449',
  },
  {
    url: 'https://troovyfoods.com/products/the-healthy-butter-cookie',
    expected: 260,
    note: 'multiple pack-size variants on page',
  },
  {
    url: 'https://troovyfoods.com/products/the-healthy-tomato-ketchup-no-onion-no-garlic',
    expected: 165,
    note: 'sale price vs strikethrough MRP 175',
  },
  {
    url: 'https://troovyfoods.com/products/the-healthy-breakfast-combo',
    expected: 999,
    note: 'combo/bundle product',
  },
  {
    url: 'https://gullylabs.com/products/gully-number-001-baaz-faris-black-men',
    expected: 3790,
    note: 'different site, decimal price format (₹3,790.00)',
  },
  {
    url: 'https://gullylabs.com/products/gully-17-jersey-gati-beige-crew-neck',
    expected: 1990,
    note: 'different site, apparel with size variants',
  },
  {
    url: 'https://www.mokobara.com/products/the-transit-backpack',
    expected: 5999,
    note: 'third site, deep discount vs MRP 9,999 (40% off)',
  },
  {
    url: 'https://www.mokobara.com/products/stash-card-sleeve',
    expected: 1399,
    note: 'third site, sale price vs strikethrough MRP 2,299',
  },
];

async function main() {
  const results = [];

  for (const { url, expected, note } of CASES) {
    const { price, guardrail } = await runPriceAgent(url);
    const pass = price === expected;
    results.push({ url, note, expected, actual: price, guardrail, pass });
  }

  console.log('\n--- Eval results ---');
  for (const r of results) {
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(
      `[${status}] ${r.url}\n       expected=${r.expected} actual=${r.actual} guardrail=${r.guardrail} (${r.note})`
    );
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} passed`);

  if (passed !== results.length) {
    process.exit(1);
  }
}

main();
