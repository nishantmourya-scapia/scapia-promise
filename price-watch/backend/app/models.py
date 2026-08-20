"""SQLModel classes mapped onto the tables defined in schema.sql (1:1).

We do NOT call ``create_all`` — tables come from schema.sql (see db.init_db) so the
CHECK constraints and partial indexes are preserved. These classes are just the ORM
mapping for reads/writes.
"""
from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Product(SQLModel, table=True):
    __tablename__ = "product"
    id: str = Field(primary_key=True)
    title: str
    image_url: Optional[str] = None
    price: int                     # Scapia (our) price
    created_at: str
    updated_at: str


class DtcSource(SQLModel, table=True):
    __tablename__ = "dtc_source"
    id: str = Field(primary_key=True)
    product_id: str = Field(foreign_key="product.id")
    label: str
    url: Optional[str] = None
    latest_price: Optional[int] = None
    latest_observed_at: Optional[str] = None
    created_at: str
    updated_at: str


class CrawlRun(SQLModel, table=True):
    __tablename__ = "crawl_run"
    id: Optional[int] = Field(default=None, primary_key=True)
    dtc_source_id: str = Field(foreign_key="dtc_source.id")
    status: str                    # OK | DEGRADED | FAILED
    price: Optional[int] = None
    product_name: Optional[str] = None
    confidence: Optional[float] = None
    error: Optional[str] = None
    crawled_at: str
    ingested_at: Optional[str] = None


class PriceObservation(SQLModel, table=True):
    __tablename__ = "price_observation"
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: str = Field(foreign_key="product.id")
    dtc_source_id: Optional[str] = None            # NULL => SCAPIA, set => DTC
    price: int
    observed_at: str
    origin: str                    # INTERNAL | MOCK_CRAWL | AI_CRAWL
    crawl_run_id: Optional[int] = None


class Watch(SQLModel, table=True):
    __tablename__ = "watch"
    id: str = Field(primary_key=True)
    user_id: str
    product_id: str = Field(foreign_key="product.id")
    status: str = "ACTIVE"         # ACTIVE | TRIGGERED | CANCELLED | FAILED
    last_result: Optional[str] = None  # WAITING | MATCHED | BEATEN
    triggered_scapia_price: Optional[int] = None
    triggered_dtc_price: Optional[int] = None
    created_at: str
    updated_at: str
    last_evaluated_at: Optional[str] = None
    triggered_at: Optional[str] = None


class Notification(SQLModel, table=True):
    __tablename__ = "notification"
    id: Optional[int] = Field(default=None, primary_key=True)
    watch_id: str = Field(foreign_key="watch.id")
    user_id: str
    kind: str                      # MATCHED | BEATEN
    scapia_price: int
    dtc_price: int
    savings: int = 0
    buy_url: str
    created_at: str
    delivered_at: Optional[str] = None
    buy_clicked_at: Optional[str] = None
