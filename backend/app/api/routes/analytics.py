"""Analytics endpoints — SQLite prediction history."""

import json
from pathlib import Path

from fastapi import APIRouter, Query

from app.db.analytics import get_prediction_stats, get_recent_predictions
from app.models.engagement_predictor import FEATURE_LABELS, get_feature_importances

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

_MODEL_METRICS_PATH = Path(__file__).resolve().parents[3] / "models" / "engagement.metrics.json"


@router.get("/recent")
def recent_predictions(limit: int = Query(default=20, ge=1, le=100)):
    return {"predictions": get_recent_predictions(limit)}


@router.get("/stats")
def prediction_stats():
    return get_prediction_stats()


@router.get("/model-metrics")
def model_metrics():
    """Held-out evaluation metrics from training (for dashboard display)."""
    payload: dict = {
        "mae": None,
        "rmse": None,
        "r2": None,
        "n_train": None,
        "n_test": None,
        "clip_features": None,
        "feature_importances_gbr": None,
        "feature_labels": FEATURE_LABELS,
    }

    if _MODEL_METRICS_PATH.is_file():
        payload.update(json.loads(_MODEL_METRICS_PATH.read_text()))

    importances = get_feature_importances()
    if importances:
        payload["feature_importances_gbr"] = importances

    return payload
