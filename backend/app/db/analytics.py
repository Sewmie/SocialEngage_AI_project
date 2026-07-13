"""SQLite prediction log — metadata only (no image bytes stored)."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH: Path | None = None

_SCHEMA = """
CREATE TABLE IF NOT EXISTS prediction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    brand_id TEXT,
    mood_id TEXT,
    content_path TEXT,
    campaign_goal_id TEXT,
    filter_name TEXT,
    top_caption TEXT,
    top_score REAL,
    popularity_level TEXT,
    caption_count INTEGER,
    hashtag_count INTEGER,
    score_delta REAL,
    factors_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_prediction_logs_created_at
    ON prediction_logs (created_at DESC);
"""


def _db_path() -> Path:
    global _DB_PATH
    if _DB_PATH is None:
        from app.config import settings

        if settings.analytics_db_path:
            _DB_PATH = Path(settings.analytics_db_path)
        else:
            _DB_PATH = Path(__file__).resolve().parents[2] / "data" / "analytics.db"
    return _DB_PATH


def init_db() -> None:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as conn:
        conn.executescript(_SCHEMA)


def log_prediction(
    *,
    brand_id: str,
    mood_id: str,
    content_path: str,
    campaign_goal_id: str | None,
    top_caption: str,
    top_score: float,
    popularity_level: str,
    caption_count: int,
    hashtag_count: int,
    score_delta: float | None,
    factors: dict,
) -> int:
    init_db()
    created_at = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(_db_path()) as conn:
        cur = conn.execute(
            """
            INSERT INTO prediction_logs (
                created_at, brand_id, mood_id, content_path, campaign_goal_id,
                filter_name, top_caption, top_score, popularity_level,
                caption_count, hashtag_count, score_delta, factors_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                brand_id,
                mood_id,
                content_path,
                campaign_goal_id,
                "",
                top_caption[:500],
                round(float(top_score), 2),
                popularity_level,
                caption_count,
                hashtag_count,
                round(float(score_delta), 2) if score_delta is not None else None,
                json.dumps(factors),
            ),
        )
        conn.commit()
        return int(cur.lastrowid or 0)


def get_recent_predictions(limit: int = 20) -> list[dict]:
    init_db()
    limit = max(1, min(limit, 100))
    with sqlite3.connect(_db_path()) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id, created_at, brand_id, mood_id, content_path, campaign_goal_id,
                   filter_name, top_caption, top_score, popularity_level,
                   caption_count, hashtag_count, score_delta, factors_json
            FROM prediction_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    out: list[dict] = []
    for row in rows:
        item = dict(row)
        raw = item.pop("factors_json", None)
        item["factors"] = json.loads(raw) if raw else {}
        out.append(item)
    return out


def get_prediction_stats() -> dict:
    init_db()
    with sqlite3.connect(_db_path()) as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_predictions,
                ROUND(AVG(top_score), 2) AS avg_top_score,
                ROUND(MIN(top_score), 2) AS min_top_score,
                ROUND(MAX(top_score), 2) AS max_top_score
            FROM prediction_logs
            """
        ).fetchone()
    return {
        "total_predictions": row[0] or 0,
        "avg_top_score": row[1],
        "min_top_score": row[2],
        "max_top_score": row[3],
    }
