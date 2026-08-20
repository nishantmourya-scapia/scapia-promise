import 'dotenv/config';
import { runPriceAgent } from './src/priceAgent.mjs';

const API_BASE_URL = process.env.CRAWL_API_BASE_URL || 'http://localhost:8000';
const POLL_INTERVAL_MS = Number(process.env.CRON_POLL_INTERVAL_MS) || 60_000;

// Testing aid: skip running the agent/reporting entirely, just fetch and
// log the worklist each cycle. Set CRON_DRY_RUN=true to enable.
const DRY_RUN = process.env.CRON_DRY_RUN === 'true';

// Testing aid: run the agent as normal but skip the POST to crawl-runs,
// just log the payload that would have been sent. Set CRON_SKIP_REPORT=true.
const SKIP_REPORT = process.env.CRON_SKIP_REPORT === 'true';

// Testing aid: run a single cycle and exit instead of looping forever.
// Set CRON_ONCE=true.
const RUN_ONCE = process.env.CRON_ONCE === 'true';

// Cap parallel browser instances so puppeteer doesn't launch an unbounded
// number of Chromium processes when the worklist is large.
const CONCURRENCY = 5;

async function getWorklist() {
  const res = await fetch(`${API_BASE_URL}/api/internal/crawl-worklist`);
  if (!res.ok) {
    throw new Error(`crawl-worklist failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function reportRun(runIn) {
  const res = await fetch(`${API_BASE_URL}/api/internal/crawl-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(runIn),
  });
  if (!res.ok) {
    throw new Error(`crawl-runs failed: ${res.status} ${res.statusText}`);
  }
}

const FAILURE_REASONS = {
  no_price_found: 'No price found on page',
  unparseable_response: 'Model response did not match expected format',
  out_of_range: 'Extracted price outside plausible range',
};

// Maps our internal agent output (see src/responseParser.mjs) onto the
// CrawlRunIn contract. price must be null iff status is FAILED:
// - ok             -> OK, verified price
// - ungrounded     -> DEGRADED, plausible-range price that couldn't be
//                     verified against the scraped page text
// - regex_fallback -> DEGRADED, price recovered by regex straight off the
//                     scraped text after the model itself failed to
//                     extract one (no LLM judgment behind this number)
// - anything else  -> FAILED, no usable price
function toCrawlRun(item, result) {
  const { guardrail, price, rawPrice, basis, error } = result;

  if (guardrail === 'ok') {
    return { dtcSourceId: item.dtcSourceId, status: 'OK', price, confidence: 1 };
  }

  if (guardrail === 'ungrounded') {
    return {
      dtcSourceId: item.dtcSourceId,
      status: 'DEGRADED',
      price: rawPrice,
      confidence: 0.5,
      error: `Price not found verbatim in page text (basis: ${basis})`,
    };
  }

  if (guardrail === 'regex_fallback') {
    return {
      dtcSourceId: item.dtcSourceId,
      status: 'DEGRADED',
      price: rawPrice,
      confidence: 0.3,
      error: 'Model could not extract a price; recovered via regex fallback on scraped text',
    };
  }

  return {
    dtcSourceId: item.dtcSourceId,
    status: 'FAILED',
    price: null,
    error: FAILURE_REASONS[guardrail] || error || 'Unknown failure',
  };
}

// Bounded-concurrency map: runs `fn` over `items` with at most `limit`
// concurrent calls in flight.
async function mapWithConcurrency(items, limit, fn) {
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function crawlOne(item) {
  let runIn;
  try {
    const result = await runPriceAgent(item.url);
    runIn = toCrawlRun(item, result);
  } catch (error) {
    runIn = { dtcSourceId: item.dtcSourceId, status: 'FAILED', price: null, error: error.message };
  }

  if (SKIP_REPORT) {
    console.log(`[cron] (not reported) ${JSON.stringify(runIn)}`);
    return;
  }

  try {
    await reportRun(runIn);
    console.log(`[cron] reported ${item.dtcSourceId}: ${runIn.status}`);
  } catch (error) {
    console.error(`[cron] failed to report ${item.dtcSourceId}: ${error.message}`);
  }
}

async function runCycle() {
  const worklist = await getWorklist();
  console.log(`[cron] ${worklist.length} source(s) to crawl`);

  if (DRY_RUN) {
    console.log(JSON.stringify(worklist));
    return;
  }

  await mapWithConcurrency(worklist, CONCURRENCY, crawlOne);
}

async function main() {
  for (;;) {
    const cycleStart = Date.now();

    try {
      await runCycle();
    } catch (error) {
      console.error(`[cron] cycle failed: ${error.message}`);
    }

    if (RUN_ONCE) {
      return;
    }

    // Next cycle starts POLL_INTERVAL_MS after this one started, or
    // immediately if the cycle itself already ran longer than that.
    const elapsed = Date.now() - cycleStart;
    const waitMs = Math.max(0, POLL_INTERVAL_MS - elapsed);
    console.log(`[cron] cycle took ${elapsed}ms, waiting ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

main();
