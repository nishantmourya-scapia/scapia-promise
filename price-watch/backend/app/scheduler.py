"""Background price monitor — re-evaluates active watches on a fixed interval.

Implemented as an asyncio task (not a thread) so it shares the app event loop and can
push WebSocket notifications directly. `POST /demo/evaluate-now` runs the same tick.
"""
from __future__ import annotations

import asyncio

from .service import run_tick

INTERVAL_SECONDS = 10


async def scheduler_loop() -> None:
    while True:
        await asyncio.sleep(INTERVAL_SECONDS)
        try:
            result = await run_tick()
            if result["triggered"]:
                print(f"[scheduler] tick: {result}")
        except Exception as exc:  # never let the loop die
            print(f"[scheduler] tick error: {exc!r}")
