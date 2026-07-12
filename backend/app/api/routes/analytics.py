"""Analytics endpoints — SQLite prediction history."""

from fastapi import APIRouter, Query

from app.db.analytics import get_prediction_stats, get_recent_predictions

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/recent")
def recent_predictions(limit: int = Query(default=20, ge=1, le=100)):
    return {"predictions": get_recent_predictions(limit)}


@router.get("/stats")
def prediction_stats():
    return get_prediction_stats()
