# hk

Extracts the current selling price (in INR) of a product from its listing page, using a headless browser to render the page and an LLM to read the price off the rendered text.

## Setup

```
npm install
```

Create a `.env` file with:

```
API_KEY=<your key for the litellm/Odyssey gateway>
```

The gateway lives on an internal network (`api.odyssey.scapia.in`) — you need to be on the corporate network/VPN for requests to succeed.

## Usage

```
node index.mjs <product-url>
```

Prints a single JSON line to stdout:

```json
{"price": 240, "guardrail": "ok", "basis": "\"Sale price₹240\" for Pack of 4 on the main product page"}
```

- `price` — the extracted price, or `null` if any guardrail below rejected the result.
- `guardrail` — one of:
  - `ok` — passed all checks.
  - `no_price_found` — the model couldn't find a price on the page.
  - `unparseable_response` — the model didn't follow the expected response format.
  - `out_of_range` — the parsed number falls outside a plausible INR price range.
  - `ungrounded` — the parsed number never appears in the scraped page text (likely a hallucination).
  - `error` — an exception occurred (network, browser, or API failure).
- `basis` — the model's own explanation of where on the page it found the price, for auditing.
- `rawPrice` — the parsed number before any guardrail rejected it (null if the response was unparseable). Used by `cron.mjs` to still report a `DEGRADED` price when it's in-range but ungrounded.
- `error` — the caught exception message, populated only when `guardrail` is `error`.

## How it works

1. `runPriceAgent` (in `src/priceAgent.mjs`) prompts an LLM to find the product's price, giving it a `fetchDynamicWebpageText` tool.
2. When called, that tool (`src/browser.mjs`) launches headless Chromium via Puppeteer, blocks trackers/heavy assets, waits for price-looking text to render, and returns the page's visible text.
3. The model responds with a `PRICE:`/`BASIS:` formatted answer, which `src/responseParser.mjs` parses and validates against the guardrails above.

## Project layout

```
index.mjs              CLI entrypoint — loads .env, parses argv, calls runPriceAgent
regression.mjs          Regression suite (see below)
cron.mjs                Periodic crawl loop (see below)
src/
  priceAgent.mjs        Orchestrates the LLM call + tool
  browser.mjs           Puppeteer scraping (tracker/asset blocking, text extraction)
  llmClient.mjs         litellm/Odyssey client config
  responseParser.mjs    Parses the model's response and applies guardrails (pure, no I/O)
```

## Regression suite

`regression.mjs` runs `runPriceAgent` against a fixed golden set of real product URLs (across troovyfoods.com, gullylabs.com, and mokobara.com) with hand-verified expected prices, covering cases like sale-price-vs-strikethrough-MRP, multi-variant products, and combo pricing. Run it after changing the prompt, model, or scraping logic:

```
npm run regression
```

Expected prices were verified by hand on 2026-08-20. If a case starts failing, check whether the site's actual price changed before assuming a regression.

## Cron (periodic crawl loop)

`cron.mjs` is a standalone script, separate from the agent itself (`src/priceAgent.mjs`), that drives an internal watch system:

1. `GET {CRAWL_API_BASE_URL}/api/internal/crawl-worklist` — fetch DTC sources currently being watched.
2. Run `runPriceAgent` on each source's URL, up to 5 at a time (`CONCURRENCY`), to bound how many headless browsers run at once.
3. `POST {CRAWL_API_BASE_URL}/api/internal/crawl-runs` — report one result per source, mapping the agent's guardrail onto the API's status:
   - `ok` → `OK`, verified price.
   - `ungrounded` → `DEGRADED`, using the unverified `rawPrice` (still in-range, just not confirmed against the page text) — this is the only guardrail state that reports a price outside of `ok`, since the API requires `price` to be null iff `status` is `FAILED`.
   - anything else (`no_price_found`, `unparseable_response`, `out_of_range`, `error`) → `FAILED`, `price: null`, with a descriptive `error`.
4. Sleep 60s, repeat forever.

Run it with:

```
npm run cron
```

Configure the target API with `CRAWL_API_BASE_URL` in `.env` (defaults to `http://localhost:8000`). No auth is required against the internal endpoints.
