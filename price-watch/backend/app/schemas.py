"""API DTOs (camelCase over the wire). Storage is normalized; these are the
denormalized, FE-friendly views — the frontend never joins tables."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---- responses ----------------------------------------------------------------
class DtcPrice(CamelModel):
    dtc_source_id: str
    label: str
    url: Optional[str] = None
    price: Optional[int] = None
    confidence: Optional[float] = None
    last_crawl_status: Optional[str] = None


class ProductDTO(CamelModel):
    id: str
    title: str
    image_url: Optional[str] = None
    buy_url: str
    price: int                      # Scapia (our) price
    dtc: Optional[DtcPrice] = None


class WatchDTO(CamelModel):
    id: str
    user_id: str
    product_id: str
    status: str
    last_result: Optional[str] = None
    current_scapia_price: Optional[int] = None
    current_dtc_price: Optional[int] = None
    triggered_scapia_price: Optional[int] = None
    triggered_dtc_price: Optional[int] = None
    created_at: str
    triggered_at: Optional[str] = None


class ObservationDTO(CamelModel):
    kind: str                       # SCAPIA | DTC (derived from dtc_source_id)
    price: int
    observed_at: str
    origin: str


class CrawlRunDTO(CamelModel):
    id: int
    dtc_source_id: str
    status: str
    price: Optional[int] = None
    product_name: Optional[str] = None
    confidence: Optional[float] = None
    error: Optional[str] = None
    crawled_at: str
    ingested_at: Optional[str] = None


class StatsDTO(CamelModel):
    active_watches: int
    triggered: int
    dtc_sources: int
    notifications_sent: int
    buy_clicks: int


# ---- crawler API --------------------------------------------------------------
class CrawlWorkItem(CamelModel):
    """One entry of the demand-driven crawl worklist."""
    dtc_source_id: str
    label: str
    url: Optional[str] = None


class CrawlRunIn(CamelModel):
    """The row the AI crawler POSTs after crawling one DTC source."""
    dtc_source_id: str
    status: Literal["OK", "DEGRADED", "FAILED"]
    price: Optional[int] = None
    product_name: Optional[str] = None
    confidence: Optional[float] = None
    error: Optional[str] = None
    crawled_at: Optional[str] = None   # defaults to server time if omitted


# ---- requests -----------------------------------------------------------------
class CreateWatchReq(CamelModel):
    user_id: str
    product_id: str


class PriceUpdateReq(CamelModel):
    price: int
