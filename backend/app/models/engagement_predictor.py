"""Engagement prediction from fused multimodal features."""

from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path

import numpy as np

FEATURE_COLS = [
    "caption_length",
    "hashtag_count",
    "aesthetic_score",
    "scene_confidence",
    "sentiment_proxy",
    "brand_fit",
    "mood_match",
    "log_followers_norm",
]

LEGACY_FEATURE_COLS = FEATURE_COLS[:-1]

DEFAULT_WEIGHTS = {
    "caption_length": 0.08,
    "hashtag_count": 0.12,
    "aesthetic_score": 0.28,
    "scene_confidence": 0.15,
    "sentiment_proxy": 0.12,
    "brand_fit": 0.10,
    "mood_match": 0.15,
    "log_followers_norm": 0.10,
}

DEFAULT_FOLLOWERS_P99 = 500_000.0
DEFAULT_FOLLOWERS = 10_000.0

FEATURE_LABELS = {
    "caption_length": "Caption length",
    "hashtag_count": "Hashtags",
    "aesthetic_score": "Aesthetic",
    "scene_confidence": "Scene match",
    "sentiment_proxy": "Sentiment",
    "brand_fit": "Brand fit",
    "mood_match": "Mood alignment",
    "log_followers_norm": "Follower reach",
}


def _sentiment_proxy(captions: list[str]) -> float:
    positive = {"love", "happy", "best", "amazing", "grateful", "beautiful", "sun", "joy"}
    text = " ".join(captions).lower()
    hits = sum(1 for w in positive if w in text)
    return min(1.0, hits / 5)


def _mood_match(visual_mood: str, mood_id: str) -> float:
    pairs = {
        ("happy cheerful", "funny"): 0.9,
        ("happy cheerful", "festive"): 0.92,
        ("happy cheerful", "inspirational"): 0.88,
        ("happy cheerful", "promotional"): 0.82,
        ("calm peaceful", "chill"): 0.95,
        ("calm peaceful", "cozy"): 0.9,
        ("calm peaceful", "aesthetic"): 0.88,
        ("calm peaceful", "minimal"): 0.9,
        ("calm peaceful", "luxury"): 0.85,
        ("romantic dreamy", "romantic"): 0.95,
        ("romantic dreamy", "storytelling"): 0.8,
        ("energetic exciting", "bold"): 0.85,
        ("energetic exciting", "nightout"): 0.9,
        ("energetic exciting", "promotional"): 0.88,
        ("energetic exciting", "travel"): 0.82,
        ("energetic exciting", "festive"): 0.86,
        ("nostalgic melancholic", "nostalgic"): 0.95,
        ("nostalgic melancholic", "storytelling"): 0.84,
        ("nostalgic melancholic", "real"): 0.8,
        ("professional corporate", "professional"): 0.95,
        ("professional corporate", "educational"): 0.9,
        ("professional corporate", "trust"): 0.88,
        ("professional corporate", "minimal"): 0.82,
        ("professional corporate", "community"): 0.78,
        ("professional corporate", "luxury"): 0.8,
    }
    return pairs.get((visual_mood, mood_id), 0.65)


def _feature_stats(bundle) -> dict:
    if isinstance(bundle, dict):
        return bundle.get("feature_stats") or {}
    return {}


def _normalize_followers(follower_count: int | None, bundle) -> float:
    stats = _feature_stats(bundle)
    p99 = float(stats.get("followers_p99") or DEFAULT_FOLLOWERS_P99)
    default = float(stats.get("default_followers") or DEFAULT_FOLLOWERS)
    value = float(follower_count) if follower_count and follower_count > 0 else default
    if value <= 0:
        return 0.0
    return round(min(1.0, math.log1p(value) / math.log1p(max(p99, 1.0))), 4)


def _load_model():
    from app.config import settings

    path = settings.engagement_model_path or os.environ.get("ENGAGEMENT_MODEL_PATH", "")
    models_dir = Path(__file__).resolve().parents[2] / "models"

    candidates = []
    if path:
        candidates.append(Path(path))
    candidates.extend([models_dir / "engagement.joblib", models_dir / "engagement.json"])

    for candidate in candidates:
        if not candidate.is_file():
            continue
        if candidate.suffix == ".json":
            import json

            return json.loads(candidate.read_text())
        import joblib

        bundle = joblib.load(candidate)
        if isinstance(bundle, dict) and "model" in bundle:
            return bundle
        return {"model": bundle, "feature_cols": LEGACY_FEATURE_COLS}
    return None


def _model_feature_cols(bundle) -> list[str]:
    if isinstance(bundle, dict) and bundle.get("feature_cols"):
        return list(bundle["feature_cols"])
    return LEGACY_FEATURE_COLS


def _predict_score(model, features: np.ndarray) -> float:
    if isinstance(model, dict) and model.get("type") == "linear":
        w = model["weights"]
        b = model["bias"]
        return float(b + sum(w[i] * features[i] for i in range(len(w))))
    return float(model.predict(features.reshape(1, -1))[0])


def _level_from_score(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 45:
        return "medium"
    return "low"


def _engagement_score_kim_infer(likes: float, bundle) -> float:
    stats = _feature_stats(bundle)
    p99_likes = float(stats.get("likes_p99") or 25_741.68)
    p99_comments = float(stats.get("comments_p99") or 150.0)
    comment_ratio = float(stats.get("comments_per_like_median") or 0.0)
    comments = likes * comment_ratio
    like_n = min(1.0, likes / max(p99_likes, 1))
    comment_n = min(1.0, comments / max(p99_comments, 1))
    raw = 0.65 * like_n + 0.35 * comment_n
    return round(100 * raw, 1)


def _level_from_likes(likes: float, bundle) -> str:
    stats = _feature_stats(bundle)
    p33 = float(stats.get("likes_p33") or 462)
    p66 = float(stats.get("likes_p66") or 2_050)
    if likes >= p66:
        return "high"
    if likes >= p33:
        return "medium"
    return "low"


def _predict_likes(features: np.ndarray, model_bundle) -> float | None:
    if not isinstance(model_bundle, dict) or not model_bundle.get("likes_model"):
        return None
    log_pred = float(model_bundle["likes_model"].predict(features.reshape(1, -1))[0])
    return max(0.0, float(np.expm1(log_pred)))


def _compose_prediction(
    features: np.ndarray,
    factors: dict,
    model_bundle,
) -> dict:
    predicted_likes = _predict_likes(features, model_bundle)

    if predicted_likes is not None:
        likes = predicted_likes
        engagement_score = _engagement_score_kim_infer(likes, model_bundle)
        popularity_level = _level_from_likes(likes, model_bundle)
    else:
        score = _score_features(features, model_bundle)
        engagement_score = round(score, 1)
        popularity_level = _level_from_score(score)
        likes = None

    result = {
        "engagement_score": engagement_score,
        "popularity_level": popularity_level,
        "factors": factors,
    }
    if likes is not None:
        result["predicted_likes"] = int(round(likes))
        result["factors"] = {**factors, "predicted_likes": int(round(likes))}
    return result


def _build_features(
    captions: list[str],
    hashtags: list[str],
    visual: dict,
    mood_id: str,
    brand_id: str,
    follower_count: int | None = None,
    model_bundle=None,
) -> tuple[np.ndarray, dict]:
    avg_len = np.mean([len(c) for c in captions]) if captions else 0
    hashtag_count = len(hashtags)
    aesthetic = float(visual.get("aesthetic_score", 0.5))
    scene_scores = visual.get("scene_scores") or {}
    scene_conf = max(scene_scores.values()) if scene_scores else 0.4
    sentiment = _sentiment_proxy(captions)
    mood_match = _mood_match(visual.get("dominant_mood", ""), mood_id)
    brand_fit = 0.75 if brand_id in ("local_sme", "casual_creator") else 0.7
    log_followers_norm = _normalize_followers(follower_count, model_bundle)

    factor_map = {
        "caption_length": min(1.0, avg_len / 120),
        "hashtag_count": min(1.0, hashtag_count / 15),
        "aesthetic_score": aesthetic,
        "scene_confidence": scene_conf,
        "sentiment_proxy": sentiment,
        "brand_fit": brand_fit,
        "mood_match": mood_match,
        "log_followers_norm": log_followers_norm,
    }

    cols = _model_feature_cols(model_bundle) if model_bundle else FEATURE_COLS
    features = np.array([factor_map[c] for c in cols])

    factors = {
        "caption_length_norm": round(float(factor_map["caption_length"]), 3),
        "hashtag_count_norm": round(float(factor_map["hashtag_count"]), 3),
        "aesthetic_score": round(aesthetic, 3),
        "scene_confidence": round(scene_conf, 3),
        "sentiment_proxy": round(sentiment, 3),
        "brand_fit": round(brand_fit, 3),
        "mood_match": round(mood_match, 3),
        "log_followers_norm": log_followers_norm,
        "follower_count": int(follower_count) if follower_count and follower_count > 0 else None,
    }
    return features, factors


def _score_features(features: np.ndarray, model_bundle) -> float:
    if model_bundle is not None:
        if isinstance(model_bundle, dict) and model_bundle.get("type") == "linear":
            score = _predict_score(model_bundle, features)
        elif isinstance(model_bundle, dict) and "model" in model_bundle:
            score = _predict_score(model_bundle["model"], features)
        else:
            score = _predict_score(model_bundle, features)
        return max(0.0, min(100.0, score))

    cols = _model_feature_cols(model_bundle)
    w = DEFAULT_WEIGHTS
    raw = sum(w.get(col, 0.0) * features[i] for i, col in enumerate(cols))
    return round(raw * 100, 1)


def build_engagement_tips(factors: dict[str, float]) -> list[str]:
    tips: list[str] = []

    if factors.get("caption_length_norm", 1) < 0.45:
        tips.append("Shorten your hook — lead with a punchy first line under 120 characters.")
    elif factors.get("caption_length_norm", 0) > 0.92:
        tips.append("Trim the caption — very long posts often lose scroll-stopping power on mobile.")

    if factors.get("hashtag_count_norm", 1) < 0.5:
        tips.append("Add 3–5 niche hashtags (#srilanka, industry tags) to improve discoverability.")

    if factors.get("sentiment_proxy", 1) < 0.4:
        tips.append("Use warmer, emotional words (love, grateful, amazing) to lift sentiment signal.")

    if factors.get("mood_match", 1) < 0.72:
        tips.append("Align caption tone with the image mood — try a different content tone setting.")

    if factors.get("aesthetic_score", 1) < 0.5:
        tips.append("Visual clarity is low — consider cropping, contrast, or a cleaner composition.")

    if factors.get("scene_confidence", 1) < 0.45:
        tips.append("Reference what's visibly in the photo — scene-specific captions score higher.")

    if factors.get("log_followers_norm", 1) < 0.15:
        tips.append(
            "Scores are calibrated for smaller accounts — focus on caption ranking rather than the absolute number."
        )

    if not tips:
        tips.append("Strong feature balance — your top-ranked caption is well optimised for engagement.")

    return tips[:4]


def rank_captions_by_engagement(
    captions: list[str],
    hashtags: list[str],
    visual: dict,
    mood_id: str,
    brand_id: str,
    follower_count: int | None = None,
) -> list[dict]:
    model_bundle = _load_model()
    ranked: list[dict] = []

    for caption in captions:
        features, factors = _build_features(
            [caption], hashtags, visual, mood_id, brand_id, follower_count, model_bundle
        )
        prediction = _compose_prediction(features, factors, model_bundle)
        ranked.append(
            {
                "caption": caption,
                **prediction,
            }
        )

    ranked.sort(key=lambda x: x["engagement_score"], reverse=True)
    for i, item in enumerate(ranked):
        item["rank"] = i + 1
        item["recommended"] = i == 0
    return ranked


def build_engagement_comparison(ranked: list[dict]) -> dict | None:
    if len(ranked) < 2:
        return None

    worst = ranked[-1]
    best = ranked[0]
    delta = round(best["engagement_score"] - worst["engagement_score"], 1)
    likes_delta = None
    if best.get("predicted_likes") is not None and worst.get("predicted_likes") is not None:
        likes_delta = int(best["predicted_likes"]) - int(worst["predicted_likes"])

    return {
        "baseline_label": "Standard caption (no ML ranking)",
        "baseline_caption": worst["caption"],
        "baseline_score": worst["engagement_score"],
        "baseline_likes": worst.get("predicted_likes"),
        "optimized_label": "ML-recommended caption",
        "optimized_caption": best["caption"],
        "optimized_score": best["engagement_score"],
        "optimized_likes": best.get("predicted_likes"),
        "score_delta": delta,
        "likes_delta": likes_delta,
    }


def predict_engagement(
    captions: list[str],
    hashtags: list[str],
    visual: dict,
    mood_id: str,
    brand_id: str,
    follower_count: int | None = None,
) -> dict:
    model_bundle = _load_model()
    features, factors = _build_features(
        captions, hashtags, visual, mood_id, brand_id, follower_count, model_bundle
    )
    return _compose_prediction(features, factors, model_bundle)


def _extract_hashtags(text: str) -> list[str]:
    return re.findall(r"#[\w]+", text)


def _models_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "models"


def get_feature_importances() -> dict[str, float] | None:
    """GBR feature importances from the production model or evaluation report."""
    bundle = _load_model()
    if isinstance(bundle, dict) and "model" in bundle:
        model = bundle["model"]
        cols = _model_feature_cols(bundle)
        if hasattr(model, "feature_importances_"):
            return {
                col: round(float(val), 4)
                for col, val in zip(cols, model.feature_importances_, strict=False)
            }

    models_dir = _models_dir()
    for name in ("engagement.metrics.json", "hybrid_evaluation_report.json"):
        path = models_dir / name
        if not path.is_file():
            continue
        data = json.loads(path.read_text())
        raw = data.get("feature_importances_gbr")
        if isinstance(raw, dict) and raw:
            return {str(k): round(float(v), 4) for k, v in raw.items()}
    return None


def score_user_caption(
    caption: str,
    visual: dict,
    mood_id: str,
    brand_id: str,
    follower_count: int | None = None,
    *,
    best_caption: str | None = None,
    best_score: float | None = None,
) -> dict:
    """Score a user-provided caption against the trained engagement model."""
    text = caption.strip()
    if not text:
        raise ValueError("Caption cannot be empty.")

    hashtags = _extract_hashtags(text)
    model_bundle = _load_model()
    features, factors = _build_features(
        [text], hashtags, visual, mood_id, brand_id, follower_count, model_bundle
    )
    prediction = _compose_prediction(features, factors, model_bundle)

    result: dict = {
        "caption": text,
        "hashtags_detected": hashtags,
        "engagement": prediction,
        "engagement_tips": build_engagement_tips(prediction["factors"]),
    }

    if best_score is not None:
        result["vs_best"] = {
            "best_caption": best_caption or "",
            "best_score": round(float(best_score), 1),
            "score_delta": round(float(best_score) - prediction["engagement_score"], 1),
        }

    return result
