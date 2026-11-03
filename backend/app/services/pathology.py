"""MOCK pathology triage.

A real system would run a validated model on smartphone-microscope images. This MVP
derives a deterministic pseudo-score from the image bytes so the queue behaves
realistically in a demo. It does NOT analyse tissue and must never inform care.
"""
from __future__ import annotations

import hashlib

DISCLAIMER = "AI suggestion — pathologist must confirm."

NOTES = {
    "urgent": "Mock model flags dense, irregular regions for first review. " + DISCLAIMER,
    "priority": "Mock model flags some atypical-looking areas. " + DISCLAIMER,
    "routine": "Mock model sees no high-priority pattern. " + DISCLAIMER,
}


def band_for_urgency(score: int) -> str:
    if score >= 75:
        return "urgent"
    if score >= 45:
        return "priority"
    return "routine"


def mock_urgency(image_bytes: bytes) -> int:
    """Deterministic 5-98 score from the file hash (same image -> same score)."""
    digest = hashlib.sha256(image_bytes).digest()
    return 5 + int.from_bytes(digest[:2], "big") % 94
