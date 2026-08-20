from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import crawler, dashboard, demo, products, watches
from .scheduler import scheduler_loop
from .seed import seed
from .ws import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed()
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()


app = FastAPI(title="Scapia Price Watch", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(watches.router)
app.include_router(demo.router)
app.include_router(dashboard.router)
app.include_router(crawler.router)


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/ws/notifications")
async def notifications(ws: WebSocket, userId: str = "demo-user"):
    await manager.connect(userId, ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive; client may ping
    except WebSocketDisconnect:
        manager.disconnect(userId, ws)
    except Exception:
        manager.disconnect(userId, ws)
