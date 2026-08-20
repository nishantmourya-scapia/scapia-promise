from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from .. import service
from ..db import get_session
from ..schemas import CreateWatchReq, WatchDTO

router = APIRouter(prefix="/api", tags=["watches"])


@router.post("/watches", response_model=WatchDTO)
def create_watch(body: CreateWatchReq, session: Session = Depends(get_session)):
    dto = service.create_watch(session, body.user_id, body.product_id)
    if not dto:
        raise HTTPException(404, "product not found")
    return dto


@router.get("/watches", response_model=list[WatchDTO])
def list_watches(user_id: Optional[str] = Query(None, alias="userId"),
                 session: Session = Depends(get_session)):
    return service.list_watches(session, user_id)


@router.get("/watches/{watch_id}", response_model=WatchDTO)
def get_watch(watch_id: str, session: Session = Depends(get_session)):
    dto = service.get_watch(session, watch_id)
    if not dto:
        raise HTTPException(404, "watch not found")
    return dto


@router.delete("/watches/{watch_id}")
def cancel_watch(watch_id: str, session: Session = Depends(get_session)):
    if not service.cancel_watch(session, watch_id):
        raise HTTPException(404, "watch not found")
    return {"status": "CANCELLED"}


@router.post("/watches/{watch_id}/buy-click")
def buy_click(watch_id: str, session: Session = Depends(get_session)):
    ok = service.register_buy_click(session, watch_id)
    return {"ok": ok}
