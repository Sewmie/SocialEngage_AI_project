"""Shared feature column names for engagement model training and inference."""

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

TARGET = "engagement_score"
