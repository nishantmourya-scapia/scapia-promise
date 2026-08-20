"""WebSocket hub — the shopper's real-time notification channel, keyed by userId.

The dashboard uses REST polling; WS is reserved for the price-match "wow" moment.
"""
from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._by_user: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._by_user[user_id].add(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        self._by_user.get(user_id, set()).discard(ws)

    async def send_to_user(self, user_id: str, payload: dict) -> bool:
        """Returns True if delivered to at least one live socket."""
        delivered = False
        for ws in list(self._by_user.get(user_id, set())):
            try:
                await ws.send_json(payload)
                delivered = True
            except Exception:
                self.disconnect(user_id, ws)
        return delivered


manager = ConnectionManager()
