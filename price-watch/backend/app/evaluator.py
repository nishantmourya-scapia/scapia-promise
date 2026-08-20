"""The deterministic core. NO LLM, NO I/O — a pure function, unit-tested.

    DTC is the benchmark. Scapia is the destination.
    Notify when the Scapia price is at or below the DTC price.
"""
from __future__ import annotations

WAITING = "WAITING"
MATCHED = "MATCHED"
BEATEN = "BEATEN"


def evaluate(scapia_price: int, dtc_price: int) -> str:
    """Compare current Scapia price against the current DTC benchmark."""
    if scapia_price > dtc_price:
        return WAITING
    if scapia_price == dtc_price:
        return MATCHED
    return BEATEN  # scapia_price < dtc_price


def should_trigger(result: str) -> bool:
    return result in (MATCHED, BEATEN)


def savings(scapia_price: int, dtc_price: int) -> int:
    """How much cheaper Scapia is than the benchmark (0 when merely matched)."""
    return max(dtc_price - scapia_price, 0)
