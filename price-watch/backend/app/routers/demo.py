from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import service
from ..db import get_session
from ..schemas import PriceUpdateReq, ProductDTO

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/products/{product_id}/scapia-price", response_model=ProductDTO)
def set_scapia_price(product_id: str, body: PriceUpdateReq, session: Session = Depends(get_session)):
    dto = service.set_scapia_price(session, product_id, body.price)
    if not dto:
        raise HTTPException(404, "product not found")
    return dto


@router.post("/dtc-sources/{dtc_source_id}/dtc-price", response_model=ProductDTO)
def set_dtc_price(dtc_source_id: str, body: PriceUpdateReq, session: Session = Depends(get_session)):
    """Inserts a mock crawl_run — the same path the real AI crawler uses."""
    dto = service.set_dtc_price_mock(session, dtc_source_id, body.price)
    if not dto:
        raise HTTPException(404, "DTC source not found")
    return dto


@router.post("/evaluate-now")
async def evaluate_now():
    """Run the scheduler tick immediately — instant on-stage trigger."""
    return await service.run_tick()
