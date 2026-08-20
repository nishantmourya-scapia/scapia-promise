"""Crawler-facing API — the AI web crawler's only integration surface.

  READ  GET  /api/internal/crawl-worklist   → what to crawl (demand-driven)
  WRITE POST /api/internal/crawl-runs        → one crawl result per source

The crawler never touches product / dtc_source / watch / notification directly; the
backend folds ingested runs into DTC prices on the scheduler tick.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import service
from ..db import get_session
from ..schemas import CrawlRunDTO, CrawlRunIn, CrawlWorkItem

router = APIRouter(prefix="/api/internal", tags=["crawler"])


@router.get("/crawl-worklist", response_model=list[CrawlWorkItem])
def crawl_worklist(session: Session = Depends(get_session)):
    """DTC sources with an ACTIVE watch — the pages worth crawling right now."""
    return service.crawl_worklist(session)


@router.post("/crawl-runs", response_model=CrawlRunDTO, status_code=201)
def ingest_crawl_run(body: CrawlRunIn, session: Session = Depends(get_session)):
    """Append one crawl result. status ∈ {OK, DEGRADED, FAILED}; price NULL iff FAILED."""
    dto = service.ingest_crawl_run(session, body)
    if dto is None:
        raise HTTPException(404, f"dtc_source not found: {body.dtc_source_id}")
    return dto
