"""Engine, session, and schema bootstrap.

The canonical DDL lives in ``schema.sql`` (with CHECK constraints + partial indexes
that SQLModel's ``create_all`` cannot express). We create tables by executing that
file, and map the SQLModel classes onto the existing tables — so schema.sql stays the
single source of truth.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import event
from sqlmodel import Session, create_engine, text

BASE_DIR = Path(__file__).resolve().parent.parent          # backend/
DB_PATH = BASE_DIR / "pricewatch.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"

ENGINE = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)


@event.listens_for(ENGINE, "connect")
def _set_sqlite_pragmas(dbapi_conn, _record):  # noqa: ANN001
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL;")
    cur.execute("PRAGMA foreign_keys=ON;")
    cur.close()


def now_iso() -> str:
    """ISO-8601 UTC timestamp, seconds precision, 'Z' suffix."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def init_db(reset: bool = False) -> None:
    if reset and DB_PATH.exists():
        for p in DB_PATH.parent.glob(DB_PATH.name + "*"):  # db + -wal + -shm
            p.unlink()
    with ENGINE.connect() as conn:
        has_tables = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='product'")
        ).first()
        if not has_tables:
            raw = conn.connection  # DBAPI connection
            raw.executescript(SCHEMA_PATH.read_text())
            raw.commit()


def get_session():
    with Session(ENGINE) as session:
        yield session
