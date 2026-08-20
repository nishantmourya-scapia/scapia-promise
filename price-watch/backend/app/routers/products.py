from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import service
from ..db import get_session
from ..schemas import CrawlRunDTO, ObservationDTO, ProductDTO

router = APIRouter(prefix="/api", tags=["products"])


@router.get("/products", response_model=list[ProductDTO])
def list_products(session: Session = Depends(get_session)):
    return service.list_products(session)


@router.get("/products/{product_id}", response_model=ProductDTO)
def get_product(product_id: str, session: Session = Depends(get_session)):
    dto = service.get_product_dto(session, product_id)
    if not dto:
        raise HTTPException(404, "product not found")
    return dto


@router.get("/products/{product_id}/observations", response_model=list[ObservationDTO])
def get_observations(product_id: str, session: Session = Depends(get_session)):
    return service.product_observations(session, product_id)


@router.get("/products/{product_id}/crawl-runs", response_model=list[CrawlRunDTO])
def get_crawl_runs(product_id: str, session: Session = Depends(get_session)):
    return service.product_crawl_runs(session, product_id)
