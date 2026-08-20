-- Scapia Price Watch — canonical schema (SQLite)
-- Source of truth for the data model. SQLModel classes in app/models.py mirror this 1:1.
--
-- Model shape:
--   * The Scapia price is INTERNAL — it lives directly on `product` (we own it).
--   * The DTC price is EXTERNAL/scraped — it lives on `dtc_source`, written via `crawl_run`.
--   * `price_observation` is the append-only history for both sides (feeds the chart).
--
-- Conventions:
--   * Money      : INTEGER, whole rupees (INR) for the POC. Switch to minor units for prod.
--   * Timestamps : TEXT, ISO-8601 UTC (e.g. '2026-08-20T09:30:00Z').
--   * Booleans   : INTEGER 0/1.   Enums: TEXT + CHECK.
--   * Current DTC price is a denormalised read-cache (dtc_source.latest_price); truth is the log.

PRAGMA journal_mode = WAL;      -- two writers: backend + crawler
PRAGMA foreign_keys = ON;       -- must be set per-connection

-- ─────────────────────────────────────────────────────────────────────────────
-- product : catalogue + the Scapia (internal) price. No DTC data, no buy_url
--           (the Scapia buy link is derived from id, not stored).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE product (
    id                  TEXT PRIMARY KEY,               -- slug, e.g. 'sony-wh1000xm6'
    title               TEXT NOT NULL,                  -- product title
    image_url           TEXT,
    price               INTEGER NOT NULL,               -- Scapia (our) price
    rating              REAL CHECK (rating IS NULL OR (rating >= 0.0 AND rating <= 10.0)),
    brand               TEXT,
    category            TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- dtc_source : one product → one (or more) DTC listing(s). ⭐ A row here IS the
--   product→crawl mapping (product_id ↔ url). Holds the cached latest DTC price
--   (denormalised read-cache; truth is the price_observation log). Crawl worklist is
--   demand-driven: DTC sources that have an ACTIVE watch (see app/service / crawl-worklist API).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dtc_source (
    id                  TEXT PRIMARY KEY,        -- e.g. 'sony-wh1000xm6:DTC'
    product_id          TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    label               TEXT NOT NULL,           -- 'Sony India'
    url                 TEXT,                    -- DTC page to crawl
    latest_price        INTEGER,                 -- cached current DTC price (last folded crawl)
    latest_observed_at  TEXT,                    -- when that price was captured
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE INDEX ix_dtc_product ON dtc_source(product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- crawl_run : ⭐ THE CRAWLER CONTRACT. Mock + AI crawler INSERT here and nowhere else.
--   status/confidence describe the CRAWL, not the price. FAILED => no price.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE crawl_run (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dtc_source_id TEXT NOT NULL REFERENCES dtc_source(id) ON DELETE CASCADE,
    status        TEXT NOT NULL CHECK (status IN ('OK','DEGRADED','FAILED')),
    price         INTEGER,                       -- NULL iff FAILED
    product_name  TEXT,                          -- what the crawler read (identity sanity-check)
    confidence    REAL CHECK (confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)),
    error         TEXT,                          -- reason on DEGRADED/FAILED
    crawled_at    TEXT NOT NULL,                 -- crawler's capture time
    ingested_at   TEXT                           -- backend stamp; NULL = pending fold
);

CREATE INDEX ix_crawl_pending ON crawl_run(dtc_source_id, id DESC) WHERE ingested_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- price_observation : append-only history for both sides; current price = latest row.
--   SCAPIA rows have dtc_source_id NULL; DTC rows point at their dtc_source.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE price_observation (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    dtc_source_id TEXT REFERENCES dtc_source(id) ON DELETE CASCADE,   -- NULL for SCAPIA
    price         INTEGER NOT NULL,
    observed_at   TEXT NOT NULL,
    origin        TEXT NOT NULL CHECK (origin IN ('INTERNAL','MOCK_CRAWL','AI_CRAWL')),
    crawl_run_id  INTEGER REFERENCES crawl_run(id) ON DELETE SET NULL
);

CREATE INDEX ix_obs_product_time ON price_observation(product_id, observed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- watch : one user's price watch. Live prices are derived; only the trigger snapshot is frozen.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE watch (
    id                     TEXT PRIMARY KEY,     -- uuid
    user_id                TEXT NOT NULL,        -- from real auth svc; stored, not validated
    product_id             TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    status                 TEXT NOT NULL DEFAULT 'ACTIVE'
                             CHECK (status IN ('ACTIVE','TRIGGERED','CANCELLED','FAILED')),
    last_result            TEXT CHECK (last_result IN ('WAITING','MATCHED','BEATEN')),
    triggered_scapia_price INTEGER,              -- frozen at trigger (numbers the notification quotes)
    triggered_dtc_price    INTEGER,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    last_evaluated_at      TEXT,
    triggered_at           TEXT
);

CREATE INDEX ix_watch_active  ON watch(status) WHERE status = 'ACTIVE';
CREATE INDEX ix_watch_user    ON watch(user_id);
CREATE UNIQUE INDEX ux_watch_user_product_active ON watch(user_id, product_id) WHERE status = 'ACTIVE';

-- ─────────────────────────────────────────────────────────────────────────────
-- notification : immutable record. Drives the full conversion funnel (§23 metrics).
--   buy_url is a snapshot of the derived Scapia buy link at trigger time.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE notification (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_id       TEXT NOT NULL REFERENCES watch(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL,
    kind           TEXT NOT NULL CHECK (kind IN ('MATCHED','BEATEN')),
    scapia_price   INTEGER NOT NULL,
    dtc_price      INTEGER NOT NULL,
    savings        INTEGER NOT NULL DEFAULT 0,   -- max(dtc - scapia, 0)
    buy_url        TEXT NOT NULL,
    created_at     TEXT NOT NULL,                -- "sent"
    delivered_at   TEXT,                         -- WS actually pushed
    buy_clicked_at TEXT                          -- conversion event
);

CREATE INDEX ix_notif_watch ON notification(watch_id);
