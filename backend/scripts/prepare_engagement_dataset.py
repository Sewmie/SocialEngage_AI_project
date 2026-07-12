"""
Convert a raw Instagram-style CSV into training features for the engagement model.

Supports common column names (auto-detected). Computes engagement_score 0–100
from likes/comments if not already present.

Usage:
  python scripts/prepare_engagement_dataset.py --csv raw/instagram.csv --out data/training_features.csv
  python scripts/train_engagement_model.py --csv data/training_features.csv --out models/engagement.joblib
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import pandas as pd

# Aliases → canonical name
CAPTION_ALIASES = ["caption", "Caption", "text", "post_text", "description", "Post Caption"]
LIKES_ALIASES = ["likes", "Likes", "like_count", "num_likes", "Like Count"]
COMMENTS_ALIASES = ["comments", "Comments", "comment_count", "num_comments", "Comment Count"]
HASHTAGS_ALIASES = ["hashtags", "Hashtags", "tags", "hashtag_list"]
HASHTAG_COUNT_ALIASES = ["hashtag_count", "num_hashtags", "hashtag_num"]


def _pick_column(df: pd.DataFrame, aliases: list[str]) -> str | None:
    for a in aliases:
        if a in df.columns:
            return a
    lower = {c.lower(): c for c in df.columns}
    for a in aliases:
        if a.lower() in lower:
            return lower[a.lower()]
    return None


def _count_hashtags(row: pd.Series, caption_col: str | None, tags_col: str | None, count_col: str | None) -> int:
    if count_col and pd.notna(row.get(count_col)):
        try:
            return int(row[count_col])
        except (TypeError, ValueError):
            pass
    parts: list[str] = []
    if tags_col and pd.notna(row.get(tags_col)):
        parts.append(str(row[tags_col]))
    if caption_col and pd.notna(row.get(caption_col)):
        parts.append(str(row[caption_col]))
    combined = " ".join(parts)
    # Handles #tag#tag and #tag #tag formats
    found = re.findall(r"#\w+", combined)
    return len(found) if found else 0


def _sentiment_proxy(text: str) -> float:
    positive = {"love", "happy", "best", "amazing", "grateful", "beautiful", "sun", "joy", "thank"}
    words = text.lower().split()
    hits = sum(1 for w in words if any(p in w for p in positive))
    return min(1.0, hits / 5)


def _engagement_score_from_metrics(
    likes: float,
    comments: float,
    saves: float,
    shares: float,
    impressions: float,
    follows: float,
    p99: dict[str, float],
) -> float:
    """Composite Instagram engagement index 0–100 (likes, comments, saves, shares, follows, ER)."""
    like_n = min(1.0, likes / max(p99.get("likes", 1), 1))
    comment_n = min(1.0, comments / max(p99.get("comments", 1), 1))
    save_n = min(1.0, saves / max(p99.get("saves", 1), 1))
    share_n = min(1.0, shares / max(p99.get("shares", 1), 1))
    follow_n = min(1.0, follows / max(p99.get("follows", 1), 1))
    er = (likes + comments + saves + shares) / max(impressions, 1)
    er_n = min(1.0, er / max(p99.get("er", 0.01), 0.001))

    raw = (
        0.30 * like_n
        + 0.15 * comment_n
        + 0.15 * save_n
        + 0.10 * share_n
        + 0.10 * follow_n
        + 0.20 * er_n
    )
    return round(100 * raw, 2)


def _engagement_score_kim(likes: float, comments: float, p99: dict[str, float]) -> float:
    """Kim WWW'20 target — likes + comment count only (no impressions/saves in dataset)."""
    like_n = min(1.0, likes / max(p99.get("likes", 1), 1))
    comment_n = min(1.0, comments / max(p99.get("comments", 1), 1))
    raw = 0.65 * like_n + 0.35 * comment_n
    return round(100 * raw, 2)


def prepare(
    df: pd.DataFrame,
    use_clip: bool = False,
    image_col: str | None = None,
    score_mode: str = "full",
) -> pd.DataFrame:
    caption_col = _pick_column(df, CAPTION_ALIASES)
    likes_col = _pick_column(df, LIKES_ALIASES)
    comments_col = _pick_column(df, COMMENTS_ALIASES)
    tags_col = _pick_column(df, HASHTAGS_ALIASES)
    count_col = _pick_column(df, HASHTAG_COUNT_ALIASES)

    saves_col = _pick_column(df, ["saves", "Saves"])
    shares_col = _pick_column(df, ["shares", "Shares"])
    impressions_col = _pick_column(df, ["impressions", "Impressions"])
    follows_col = _pick_column(df, ["follows", "Follows"])

    if not caption_col and not likes_col:
        raise ValueError(
            "Could not find caption or likes columns. "
            f"Available: {list(df.columns)}. "
            "Need at least caption (+ likes/comments) or pre-built feature columns."
        )

    image_path_col = image_col or _pick_column(
        df, ["image_path", "image", "Image", "photo_path", "image_url", "Image URL"]
    )

    clip_fn = None
    image_fn = None
    if use_clip:
        from clip_feature_utils import extract_caption_features, extract_image_features

        clip_fn = extract_caption_features
        image_fn = extract_image_features

    rows = []
    likes_series = df[likes_col].fillna(0).astype(float) if likes_col else pd.Series([0.0] * len(df))
    comments_series = df[comments_col].fillna(0).astype(float) if comments_col else pd.Series([0.0] * len(df))
    saves_series = df[saves_col].fillna(0).astype(float) if saves_col else pd.Series([0.0] * len(df))
    shares_series = df[shares_col].fillna(0).astype(float) if shares_col else pd.Series([0.0] * len(df))
    impressions_series = (
        df[impressions_col].fillna(1).astype(float) if impressions_col else pd.Series([1.0] * len(df))
    )
    follows_series = df[follows_col].fillna(0).astype(float) if follows_col else pd.Series([0.0] * len(df))

    er_series = (likes_series + comments_series + saves_series + shares_series) / impressions_series.clip(lower=1)
    p99 = {
        "likes": float(likes_series.quantile(0.99)) or 1.0,
        "comments": float(comments_series.quantile(0.99)) or 1.0,
        "saves": float(saves_series.quantile(0.99)) or 1.0,
        "shares": float(shares_series.quantile(0.99)) or 1.0,
        "follows": float(follows_series.quantile(0.99)) or 1.0,
        "er": float(er_series.quantile(0.99)) or 0.01,
    }

    # Long-form captions in this dataset — normalize against ~500 chars
    caption_norm_divisor = 500.0
    hashtag_norm_divisor = 30.0  # posts often have 20–30 tags

    total_rows = len(df)
    for n, (_, row) in enumerate(df.iterrows()):
        if clip_fn and (n == 0 or (n + 1) % 100 == 0 or n + 1 == total_rows):
            print(f"  CLIP features: row {n + 1}/{total_rows}…", flush=True)
        caption = str(row[caption_col]) if caption_col and pd.notna(row.get(caption_col)) else ""
        caption_length = min(1.0, len(caption) / caption_norm_divisor)
        raw_tags = _count_hashtags(row, caption_col, tags_col, count_col)
        hashtag_count = min(1.0, raw_tags / hashtag_norm_divisor)
        sentiment_proxy = _sentiment_proxy(caption)

        aesthetic_score = 0.5
        scene_confidence = 0.4
        brand_fit = 0.72
        mood_match = 0.65

        if clip_fn:
            image_bytes = None
            if image_path_col and pd.notna(row.get(image_path_col)):
                raw_path = str(row[image_path_col]).strip()
                p = Path(raw_path)
                if p.is_file():
                    image_bytes = p.read_bytes()
            if image_bytes and image_fn:
                clip_feats = image_fn(image_bytes)
            else:
                clip_feats = clip_fn(caption)
            aesthetic_score = clip_feats["aesthetic_score"]
            scene_confidence = clip_feats["scene_confidence"]
            brand_fit = clip_feats["brand_fit"]
            mood_match = clip_feats["mood_match"]

        if likes_col or comments_col:
            if score_mode == "kim":
                engagement_score = _engagement_score_kim(
                    float(likes_series.iloc[n]),
                    float(comments_series.iloc[n]),
                    p99,
                )
            else:
                engagement_score = _engagement_score_from_metrics(
                    float(likes_series.iloc[n]),
                    float(comments_series.iloc[n]),
                    float(saves_series.iloc[n]),
                    float(shares_series.iloc[n]),
                    float(impressions_series.iloc[n]),
                    float(follows_series.iloc[n]),
                    p99,
                )
        elif "engagement_score" in df.columns:
            engagement_score = float(row["engagement_score"])
        else:
            engagement_score = 50.0

        rows.append(
            {
                "caption_length": round(caption_length, 4),
                "hashtag_count": round(hashtag_count, 4),
                "aesthetic_score": aesthetic_score,
                "scene_confidence": scene_confidence,
                "sentiment_proxy": round(sentiment_proxy, 4),
                "brand_fit": brand_fit,
                "mood_match": mood_match,
                "engagement_score": engagement_score,
            }
        )

    return pd.DataFrame(rows)


def main():
    parser = argparse.ArgumentParser(description="Prepare Instagram CSV for engagement model training")
    parser.add_argument("--csv", required=True, help="Raw Instagram dataset CSV")
    parser.add_argument("--out", default="data/training_features.csv")
    parser.add_argument(
        "--clip",
        action="store_true",
        help="Extract CLIP text/image features (scene, mood, aesthetic) per row",
    )
    parser.add_argument("--image-col", default=None, help="Optional CSV column with image file paths")
    parser.add_argument(
        "--score-mode",
        choices=("full", "kim"),
        default="full",
        help="full = impressions/saves/shares composite; kim = likes+comments only (WWW'20)",
    )
    args = parser.parse_args()

    df = pd.read_csv(args.csv, encoding="latin-1")
    print(f"Loaded {len(df)} rows, columns: {list(df.columns)}")

    if args.clip:
        print("Extracting CLIP features (first run downloads ~600MB model)…")

    out_df = prepare(df, use_clip=args.clip, image_col=args.image_col, score_mode=args.score_mode)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(out_path, index=False)
    print(f"Saved {len(out_df)} feature rows → {out_path}")
    print(f"engagement_score range: {out_df['engagement_score'].min():.1f} – {out_df['engagement_score'].max():.1f}")


if __name__ == "__main__":
    main()
