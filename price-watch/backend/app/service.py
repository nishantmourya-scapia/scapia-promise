"""Business logic. Deterministic; the only AI touch-point is *reading* crawl_run rows.

Data-flow invariants:
  * Scapia price is INTERNAL — stored on product.price (and logged as an observation).
  * DTC price is EXTERNAL — born from a crawl_run (mock or AI), folded by fold_crawl_runs()
    onto dtc_source.latest_price (and logged as an observation).
  * The Scapia buy link is DERIVED from the product id, never stored.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlmodel import Session, select

from .db import ENGINE, now_iso
from .evaluator import evaluate, savings, should_trigger
from .models import CrawlRun, DtcSource, Notification, PriceObservation, Product, Watch
from .schemas import (
    CrawlRunDTO,
    CrawlRunIn,
    CrawlWorkItem,
    DtcPrice,
    ObservationDTO,
    ProductDTO,
    StatsDTO,
    WatchDTO,
)
from .ws import manager

SCAPIA_SHOP_BASE = "https://app.scapia.cards/shop/"


def buy_url(product_id: str) -> str:
    return SCAPIA_SHOP_BASE + product_id


# ---- price plumbing -----------------------------------------------------------
def _log_observation(
    session: Session,
    product_id: str,
    price: int,
    origin: str,
    observed_at: str,
    dtc_source_id: Optional[str] = None,
    crawl_run_id: Optional[int] = None,
) -> None:
    session.add(PriceObservation(
        product_id=product_id,
        dtc_source_id=dtc_source_id,
        price=price,
        observed_at=observed_at,
        origin=origin,
        crawl_run_id=crawl_run_id,
    ))


def _apply_dtc_observation(
    session: Session,
    source: DtcSource,
    price: int,
    origin: str,
    observed_at: str,
    crawl_run_id: Optional[int] = None,
) -> None:
    _log_observation(
        session, source.product_id, price, origin, observed_at,
        dtc_source_id=source.id, crawl_run_id=crawl_run_id,
    )
    source.latest_price = price
    source.latest_observed_at = observed_at
    source.updated_at = now_iso()
    session.add(source)


def fold_crawl_runs(session: Session) -> int:
    """Fold pending crawl_run rows into DTC observations. Idempotent per run id.

    Origin is always AI_CRAWL for crawl-born prices (mock + real crawler share the path;
    there's no discriminator column, so provenance is not separately labelled)."""
    pending = session.exec(
        select(CrawlRun).where(CrawlRun.ingested_at.is_(None)).order_by(CrawlRun.id)
    ).all()
    folded = 0
    for run in pending:
        if run.status in ("OK", "DEGRADED") and run.price is not None:
            source = session.get(DtcSource, run.dtc_source_id)
            if source is not None:
                _apply_dtc_observation(
                    session, source, run.price, "AI_CRAWL", run.crawled_at, crawl_run_id=run.id,
                )
                folded += 1
        run.ingested_at = now_iso()
        session.add(run)
    session.commit()
    return folded


def _dtc_source(session: Session, product_id: str) -> Optional[DtcSource]:
    return session.exec(
        select(DtcSource).where(DtcSource.product_id == product_id).order_by(DtcSource.id)
    ).first()


def current_prices(session: Session, product: Product) -> tuple[int, Optional[int]]:
    dtc = _dtc_source(session, product.id)
    return product.price, (dtc.latest_price if dtc else None)


def _latest_run(session: Session, dtc_source_id: str) -> Optional[CrawlRun]:
    return session.exec(
        select(CrawlRun).where(CrawlRun.dtc_source_id == dtc_source_id).order_by(CrawlRun.id.desc())
    ).first()


# ---- DTOs ---------------------------------------------------------------------
def product_dto(session: Session, product: Product) -> ProductDTO:
    dtc = _dtc_source(session, product.id)
    dtc_dto = None
    if dtc is not None:
        run = _latest_run(session, dtc.id)
        dtc_dto = DtcPrice(
            dtc_source_id=dtc.id,
            label=dtc.label,
            url=dtc.url,
            price=dtc.latest_price,
            confidence=run.confidence if run else None,
            last_crawl_status=run.status if run else None,
        )
    return ProductDTO(
        id=product.id,
        title=product.title,
        image_url=product.image_url,
        buy_url=buy_url(product.id),
        price=product.price,
        dtc=dtc_dto,
    )


def list_products(session: Session) -> list[ProductDTO]:
    return [product_dto(session, p) for p in session.exec(select(Product)).all()]


def get_product_dto(session: Session, product_id: str) -> Optional[ProductDTO]:
    product = session.get(Product, product_id)
    return product_dto(session, product) if product else None


def watch_dto(session: Session, w: Watch) -> WatchDTO:
    product = session.get(Product, w.product_id)
    scapia, dtc = current_prices(session, product) if product else (None, None)
    return WatchDTO(
        id=w.id,
        user_id=w.user_id,
        product_id=w.product_id,
        status=w.status,
        last_result=w.last_result,
        current_scapia_price=scapia,
        current_dtc_price=dtc,
        triggered_scapia_price=w.triggered_scapia_price,
        triggered_dtc_price=w.triggered_dtc_price,
        created_at=w.created_at,
        triggered_at=w.triggered_at,
    )


# ---- watch operations ---------------------------------------------------------
def create_watch(session: Session, user_id: str, product_id: str) -> Optional[WatchDTO]:
    if session.get(Product, product_id) is None:
        return None
    existing = session.exec(
        select(Watch).where(
            Watch.user_id == user_id,
            Watch.product_id == product_id,
            Watch.status == "ACTIVE",
        )
    ).first()
    if existing:
        return watch_dto(session, existing)
    now = now_iso()
    w = Watch(
        id=str(uuid.uuid4()), user_id=user_id, product_id=product_id,
        status="ACTIVE", last_result=None, created_at=now, updated_at=now,
    )
    session.add(w)
    session.commit()
    session.refresh(w)
    return watch_dto(session, w)


def cancel_watch(session: Session, watch_id: str) -> bool:
    w = session.get(Watch, watch_id)
    if not w:
        return False
    w.status = "CANCELLED"
    w.updated_at = now_iso()
    session.add(w)
    session.commit()
    return True


def list_watches(session: Session, user_id: Optional[str]) -> list[WatchDTO]:
    q = select(Watch)
    if user_id:
        q = q.where(Watch.user_id == user_id)
    return [watch_dto(session, w) for w in session.exec(q.order_by(Watch.created_at.desc())).all()]


def get_watch(session: Session, watch_id: str) -> Optional[WatchDTO]:
    w = session.get(Watch, watch_id)
    return watch_dto(session, w) if w else None


def register_buy_click(session: Session, watch_id: str) -> bool:
    notif = session.exec(
        select(Notification).where(Notification.watch_id == watch_id).order_by(Notification.id.desc())
    ).first()
    if not notif:
        return False
    notif.buy_clicked_at = now_iso()
    session.add(notif)
    session.commit()
    return True


# ---- demo controls ------------------------------------------------------------
def set_scapia_price(session: Session, product_id: str, price: int) -> Optional[ProductDTO]:
    product = session.get(Product, product_id)
    if not product:
        return None
    now = now_iso()
    product.price = price
    product.updated_at = now
    session.add(product)
    _log_observation(session, product_id, price, "INTERNAL", now)
    session.commit()
    return get_product_dto(session, product_id)


def set_dtc_price_mock(session: Session, dtc_source_id: str, price: int) -> Optional[ProductDTO]:
    """Insert a mock crawl_run — exactly the shape the real AI crawler writes."""
    source = session.get(DtcSource, dtc_source_id)
    if not source:
        return None
    session.add(CrawlRun(
        dtc_source_id=dtc_source_id, status="OK", price=price,
        product_name=None, confidence=1.0, crawled_at=now_iso(),
    ))
    session.commit()
    fold_crawl_runs(session)  # make it visible immediately for the demo
    return get_product_dto(session, source.product_id)


# ---- the scheduler tick (shared by the loop and /demo/evaluate-now) -----------
async def run_tick() -> dict:
    """Fold crawls, evaluate active watches, fire notifications. Returns counts."""
    payloads: list[tuple[str, int, dict]] = []  # (user_id, notification_id, ws_payload)
    with Session(ENGINE) as session:
        fold_crawl_runs(session)
        active = session.exec(select(Watch).where(Watch.status == "ACTIVE")).all()
        evaluated = 0
        for w in active:
            product = session.get(Product, w.product_id)
            if not product:
                continue
            scapia, dtc = current_prices(session, product)
            if dtc is None:
                continue
            evaluated += 1
            result = evaluate(scapia, dtc)
            now = now_iso()
            w.last_result = result
            w.last_evaluated_at = now
            w.updated_at = now
            if should_trigger(result):
                w.status = "TRIGGERED"
                w.triggered_at = now
                w.triggered_scapia_price = scapia
                w.triggered_dtc_price = dtc
                link = buy_url(product.id)
                notif = Notification(
                    watch_id=w.id, user_id=w.user_id, kind=result,
                    scapia_price=scapia, dtc_price=dtc, savings=savings(scapia, dtc),
                    buy_url=link, created_at=now,
                )
                session.add(notif)
                session.flush()
                payloads.append((w.user_id, notif.id, {
                    "type": "PRICE_MATCH",
                    "watchId": w.id,
                    "productId": w.product_id,
                    "productName": product.title,
                    "scapiaPrice": scapia,
                    "dtcPrice": dtc,
                    "result": result,
                    "savings": savings(scapia, dtc),
                    "buyUrl": link,
                    "triggeredAt": now,
                }))
            session.add(w)
        session.commit()

    for user_id, notif_id, payload in payloads:
        delivered = await manager.send_to_user(user_id, payload)
        if delivered:
            with Session(ENGINE) as s2:
                n = s2.get(Notification, notif_id)
                if n:
                    n.delivered_at = now_iso()
                    s2.add(n)
                    s2.commit()

    return {"evaluated": evaluated, "triggered": len(payloads)}


# ---- crawler API --------------------------------------------------------------
def crawl_worklist(session: Session) -> list[CrawlWorkItem]:
    """DTC sources that have at least one ACTIVE watch — demand-driven, so we never
    crawl a product nobody is watching. Deduped across users watching the same product."""
    rows = session.exec(
        select(DtcSource.id, DtcSource.label, DtcSource.url)
        .join(Watch, Watch.product_id == DtcSource.product_id)
        .where(Watch.status == "ACTIVE")
        .distinct()
    ).all()
    return [CrawlWorkItem(dtc_source_id=r[0], label=r[1], url=r[2]) for r in rows]


def ingest_crawl_run(session: Session, payload: CrawlRunIn) -> Optional[CrawlRunDTO]:
    """Persist one crawl_run row from the AI crawler (append-only). The scheduler tick
    folds OK/DEGRADED runs into the DTC price within ≤10s — this endpoint only writes."""
    source = session.get(DtcSource, payload.dtc_source_id)
    if source is None:
        return None
    run = CrawlRun(
        dtc_source_id=payload.dtc_source_id,
        status=payload.status,
        price=payload.price,
        product_name=payload.product_name,
        confidence=payload.confidence,
        error=payload.error,
        crawled_at=payload.crawled_at or now_iso(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return CrawlRunDTO(
        id=run.id, dtc_source_id=run.dtc_source_id, status=run.status, price=run.price,
        product_name=run.product_name, confidence=run.confidence, error=run.error,
        crawled_at=run.crawled_at, ingested_at=run.ingested_at,
    )


# ---- dashboard / history ------------------------------------------------------
def dashboard_stats(session: Session) -> StatsDTO:
    def count(model, *where):
        q = select(model)
        for w in where:
            q = q.where(w)
        return len(session.exec(q).all())

    return StatsDTO(
        active_watches=count(Watch, Watch.status == "ACTIVE"),
        triggered=count(Watch, Watch.status == "TRIGGERED"),
        dtc_sources=count(DtcSource),
        notifications_sent=count(Notification),
        buy_clicks=count(Notification, Notification.buy_clicked_at.is_not(None)),
    )


def product_observations(session: Session, product_id: str) -> list[ObservationDTO]:
    rows = session.exec(
        select(PriceObservation)
        .where(PriceObservation.product_id == product_id)
        .order_by(PriceObservation.observed_at)
    ).all()
    return [
        ObservationDTO(
            kind="DTC" if o.dtc_source_id else "SCAPIA",
            price=o.price,
            observed_at=o.observed_at,
            origin=o.origin,
        )
        for o in rows
    ]


def product_crawl_runs(session: Session, product_id: str) -> list[CrawlRunDTO]:
    dtc_ids = [s.id for s in session.exec(
        select(DtcSource).where(DtcSource.product_id == product_id)
    ).all()]
    if not dtc_ids:
        return []
    rows = session.exec(
        select(CrawlRun).where(CrawlRun.dtc_source_id.in_(dtc_ids)).order_by(CrawlRun.id.desc())
    ).all()
    return [
        CrawlRunDTO(
            id=r.id, dtc_source_id=r.dtc_source_id, status=r.status, price=r.price,
            product_name=r.product_name, confidence=r.confidence, error=r.error,
            crawled_at=r.crawled_at, ingested_at=r.ingested_at,
        )
        for r in rows
    ]
