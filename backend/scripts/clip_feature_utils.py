"""Import helpers for scripts run from backend/scripts/."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.clip_features import extract_caption_features, extract_image_features  # noqa: E402

__all__ = ["extract_caption_features", "extract_image_features", "BACKEND_ROOT"]
