# Scapia Price Watch

Hackathon POC. **DTC is the benchmark. Scapia is the destination.** Watch a product,
we monitor the brand's (DTC) price and our own Scapia price, and the moment
`ScapiaPrice <= DtcPrice` we notify the shopper to buy on Scapia.

- **`REQUIREMENTS.md`** — scope, requirements, data model, diagrams
- **`backend/schema.sql`** — canonical DB schema (SQLite)
- **`backend/rest.http`** — every endpoint, runnable top-to-bottom

## Run it (M0 — full spine on mock data)

### Backend (FastAPI, port 8000)
```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest tests/ -q          # evaluator unit tests
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```
The DB (`backend/pricewatch.db`, SQLite/WAL) is created and seeded with 7 Gully Labs
products on first boot. Delete it to reseed. Scheduler re-evaluates active watches every 10s.

### Frontend (static, port 5173) — Seller Console
Plain HTML/JS, no build step. Lets a seller update our Scapia price per product
(`POST /api/demo/products/{id}/scapia-price`); DTC price is read-only, shown for reference.
```bash
cd frontend
python3 -m http.server 5173
```
Open http://localhost:5173.

## Demo flow
1. **Seller Console** → pick a product → enter a new Scapia price at/below its DTC price → **Update**.
2. `POST /api/watches` (or `backend/rest.http`) to watch that product, then
   `POST /api/demo/evaluate-now` to force the scheduler tick immediately.
3. The watch flips to `TRIGGERED` and a `PRICE_MATCH` event is pushed over
   `ws://…/ws/notifications?userId=`.

## Key API
| | |
|---|---|
| `GET /api/products` | catalogue: Scapia price + latest DTC price |
| `POST /api/watches` | `{userId, productId}` → create watch |
| `POST /api/demo/products/{productId}/scapia-price` | set Scapia price (updates product + logs observation) |
| `POST /api/demo/dtc-sources/{dtcSourceId}/dtc-price` | set DTC price (writes a mock `crawl_run`) |
| `POST /api/demo/evaluate-now` | run the scheduler tick immediately |
| `GET /api/products/{id}/observations` | price history · `GET …/crawl-runs` for crawl results |
| `GET /api/dashboard/stats` | funnel counters |
| `GET /api/internal/crawl-worklist` | crawler: DTC sources with an ACTIVE watch |
| `POST /api/internal/crawl-runs` | crawler: submit one crawl result |
| `ws://…/ws/notifications?userId=` | price-match push |

## M1 (next): AI crawler
The crawler is built later and stays decoupled — it talks to **two HTTP endpoints only**, never
the DB:
1. `GET /api/internal/crawl-worklist` → the DTC sources to crawl (demand-driven: only those with
   an `ACTIVE` watch).
2. for each, fetch the page → Claude-extract the price → `POST /api/internal/crawl-runs`.

The backend persists each result as a `crawl_run` and folds `OK`/`DEGRADED` ones into the DTC
price on the next scheduler tick (`FAILED` keeps the last price). The demo's mock crawler
produces the same `crawl_run` shape, so the real one is drop-in. See REQUIREMENTS.md §5 (FR-9).
