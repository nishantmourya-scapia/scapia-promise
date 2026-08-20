# scapia-promise

Team **A2N** — Scapia Sandbox 2026.

**Anirudh Goel · Asmita Raj · Nishant Mourya**

**Price Promise**: tell shoppers when a product on Scapia is at price parity with — or cheaper
than — the brand's own DTC website, so they can buy on Scapia and still earn coins.

## 📹 Demo

<a href="https://drive.google.com/file/d/1s7hDK9OMOcXe95HiwZUGby38SLvRKDvG/view?usp=sharing">
  <img src="https://drive.google.com/thumbnail?id=1s7hDK9OMOcXe95HiwZUGby38SLvRKDvG&sz=w1200" alt="Watch the Price Promise demo" width="640">
</a>

▶️ [Watch the demo](https://drive.google.com/file/d/1s7hDK9OMOcXe95HiwZUGby38SLvRKDvG/view?usp=sharing)

---

## Why

**User problem**
- Scapia's marketplace is priced by the brands themselves.
- Brands can set an SKU higher, lower, or in parity with their own DTC site — and rarely go
  below their DTC price, which suppresses adoption.
- Users would buy on Scapia far more readily if they *knew* the price is in parity or lower,
  because coins on top make it a guaranteed win.

**Supply problem**
- No signal on where we are expensive, and no signal on what users actually want on the platform.

**How we solve it**
1. User marks favourite brands/products for **price match** → registers a demand signal.
2. We periodically scrape the brand's DTC site → registers a *cheaper / parity / expensive* signal.
3. When parity is reached (DTC price rises, or our price drops via the brand or supply fixing it),
   we **notify the user** so they can buy and stack coins.

**Technical bet**
- Traditional scrapers are rigid, per-site scripts that rot.
- We replace them with an **agentic scraper**: an LLM agent with browser tools opens the target
  page, semantically locates the price, and stores it.
- No per-site script → scales to any brand website.

> **Note:** this is a sandbox MVP. It runs against a small purpose-built subset DB, not prod.

---

## Repo layout

| Folder | What it is | Stack |
|---|---|---|
| [`hk/`](hk) | Agentic price-scraping agent + cron runner | Node.js (ESM), Puppeteer, Vercel AI SDK |
| [`price-watch/`](price-watch) | Price-watch backend API + seller/ops dashboard | FastAPI + SQLite, static HTML/JS frontend |
| [`scapia-hackathon/`](scapia-hackathon) | Main consumer UI (storefront + price-drop alerts) | React 19 + TypeScript + Vite + Tailwind |

---

### `hk/` — agentic scraper (the "crawler")

The piece that replaces rigid scraping. Given a product URL, it renders the page headlessly and
uses an LLM to read the *current selling price* off the rendered text — no CSS selectors, no
per-brand script.

```
src/browser.mjs          headless page render
src/priceAgent.mjs       the agent: tools + prompt + price extraction
src/llmClient.mjs        LLM gateway client
src/responseParser.mjs   parse/validate the model's answer
index.mjs                one-shot CLI: node index.mjs <product-url>
cron.mjs                 periodic run — pulls the crawl worklist, submits crawl runs
regression.mjs           runs the agent over a fixture set of URLs to check accuracy
```

Run:
```bash
cd hk
npm install
cp .env.example .env   # set API_KEY for the LLM gateway (corporate network/VPN required)
node index.mjs <product-url>   # one-off
npm run cron                   # periodic scrape loop
npm run regression             # accuracy check across known URLs
```

Output is a single JSON line, e.g.
`{"price": 240, "guardrail": "ok", "basis": "\"Sale price₹240\" on the main product page"}`.

It talks to the backend over **two HTTP endpoints only** (never the DB):
`GET /api/internal/crawl-worklist` and `POST /api/internal/crawl-runs` — so it stays fully
decoupled and drop-in replaceable. See [`hk/README.md`](hk/README.md).

---

### `price-watch/` — backend + dashboard

The system of record. Holds products, DTC sources, watches, price observations, crawl runs, and
the evaluator that decides when a watch is **TRIGGERED** (`ScapiaPrice <= DtcPrice`).

```
backend/app/          FastAPI app (REST + WebSocket notifications)
backend/tests/        evaluator unit tests
backend/schema.sql    canonical SQLite schema
backend/rest.http     every endpoint, runnable top-to-bottom
frontend/             seller console — set our Scapia price per product (plain HTML/JS, no build)
REQUIREMENTS.md       scope, requirements, data model, diagrams
```

Run:
```bash
# backend :8000
cd price-watch/backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest tests/ -q
.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# dashboard :5173
cd price-watch/frontend && python3 -m http.server 5173
```

`pricewatch.db` is created and seeded on first boot (delete to reseed). The scheduler
re-evaluates active watches every 10s and pushes `PRICE_MATCH` events over
`ws://…/ws/notifications?userId=`. Full endpoint table in
[`price-watch/README.md`](price-watch/README.md).

---

### `scapia-hackathon/` — main consumer UI

What the shopper sees: product listing, product view with coin maths, and the price-drop /
price-match alerts feed driven by the backend's notification socket.

```
src/pages/            ProductListing, ProductView, PriceDropAlerts
src/components/       ProductCard, PriceMatchRow, CoinToggle, icons
src/priceDropSocket.ts  live PRICE_MATCH subscription
src/api.ts            backend client
```

Run:
```bash
cd scapia-hackathon
npm install
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

---

## End-to-end flow

```
user favourites a product        →  price-watch: POST /api/watches (demand signal)
hk cron                          →  GET /api/internal/crawl-worklist (only watched DTC sources)
hk agent renders + reads price   →  POST /api/internal/crawl-runs
price-watch scheduler tick       →  folds DTC price in, evaluates ScapiaPrice <= DtcPrice
on parity                        →  WS PRICE_MATCH → scapia-hackathon alerts feed → user buys + earns coins
```

---

## Conventions

- Root [`.gitignore`](.gitignore) covers all three folders: `node_modules/`, `dist/`,
  `__pycache__/`, `.venv/`, `.env`, and the runtime SQLite DB (`*.db`, `-wal`, `-shm`).
- Secrets live in per-folder `.env` files and are never committed.
- `price-watch/frontend.bak-shop/` is an old snapshot and is ignored.
