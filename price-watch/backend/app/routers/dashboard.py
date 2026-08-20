from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from .. import service
from ..db import get_session
from ..schemas import StatsDTO

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=StatsDTO)
def stats(session: Session = Depends(get_session)):
    return service.dashboard_stats(session)
