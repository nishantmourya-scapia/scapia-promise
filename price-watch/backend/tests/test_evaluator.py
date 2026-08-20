"""Unit tests for the deterministic price-match core."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.evaluator import BEATEN, MATCHED, WAITING, evaluate, savings, should_trigger


def test_waiting_when_scapia_higher():
    assert evaluate(9000, 8000) == WAITING
    assert should_trigger(WAITING) is False


def test_matched_when_equal():
    assert evaluate(8000, 8000) == MATCHED
    assert should_trigger(MATCHED) is True


def test_beaten_when_scapia_lower():
    assert evaluate(7500, 8000) == BEATEN
    assert should_trigger(BEATEN) is True


def test_boundary_zero():
    assert evaluate(0, 0) == MATCHED


def test_off_by_one_around_the_boundary():
    assert evaluate(8001, 8000) == WAITING
    assert evaluate(7999, 8000) == BEATEN


def test_savings():
    assert savings(7500, 8000) == 500   # beaten
    assert savings(8000, 8000) == 0     # matched, no savings
    assert savings(9000, 8000) == 0     # waiting, never negative
