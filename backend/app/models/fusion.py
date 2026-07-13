"""Multimodal fusion — orchestrates vision, NLP, brand, and engagement modules."""

from __future__ import annotations

from app.models.engagement_predictor import (
    build_engagement_comparison,
    build_engagement_tips,
    predict_engagement,
    rank_captions_by_engagement,
)
from app.db.analytics import log_prediction
from app.models.image_analyzer import analyze_image
from app.models.nlp_module import generate_text_content


def generate_multimodal_content(
    image_bytes: bytes,
    mime_type: str,
    filter_name: str,
    mood_id: str,
    brand_id: str,
    gemini_api_key: str,
    content_path: str = "marketing",
    campaign_goal_id: str = "awareness",
    follower_count: int | None = None,
) -> dict:
    visual = analyze_image(image_bytes)

    text = generate_text_content(
        image_bytes=image_bytes,
        mime_type=mime_type,
        visual=visual,
        filter_name=filter_name,
        mood_id=mood_id,
        brand_id=brand_id,
        api_key=gemini_api_key,
        content_path=content_path,
        campaign_goal_id=campaign_goal_id,
    )

    ranked = rank_captions_by_engagement(
        captions=text["captions"],
        hashtags=text["hashtags"],
        visual=visual,
        mood_id=mood_id,
        brand_id=brand_id,
        follower_count=follower_count,
    )
    sorted_captions = [r["caption"] for r in ranked]
    best = ranked[0] if ranked else None

    result: dict = {
        "captions": sorted_captions,
        "ranked_captions": ranked,
        "hashtags": text["hashtags"],
        "visual_analysis": {
            "scene_labels": visual["scene_labels"],
            "dominant_mood": visual["dominant_mood"],
            "aesthetic_score": visual["aesthetic_score"],
            "objects_detected": visual["objects_detected"],
        },
        "brand_id": brand_id,
        "mood_id": mood_id,
        "filter_name": filter_name,
        "content_path": content_path,
    }

    if content_path == "marketing":
        result["marketing"] = {
            "hooks": text.get("hooks", []),
            "ctas": text.get("ctas", []),
            "marketing_tips": text.get("marketing_tips", []),
        }

    result["engagement"] = (
        {
            "engagement_score": best["engagement_score"],
            "popularity_level": best["popularity_level"],
            "factors": best["factors"],
        }
        if best
        else predict_engagement(
            captions=sorted_captions,
            hashtags=text["hashtags"],
            visual=visual,
            mood_id=mood_id,
            brand_id=brand_id,
            follower_count=follower_count,
        )
    )
    result["engagement_tips"] = build_engagement_tips(result["engagement"]["factors"])
    result["engagement_comparison"] = build_engagement_comparison(ranked)

    comparison = result.get("engagement_comparison")
    try:
        log_prediction(
            brand_id=brand_id,
            mood_id=mood_id,
            content_path=content_path,
            campaign_goal_id=campaign_goal_id if content_path == "marketing" else None,
            filter_name=filter_name,
            top_caption=best["caption"] if best else "",
            top_score=result["engagement"]["engagement_score"],
            popularity_level=result["engagement"]["popularity_level"],
            caption_count=len(ranked),
            hashtag_count=len(text["hashtags"]),
            score_delta=comparison["score_delta"] if comparison else None,
            factors=result["engagement"]["factors"],
        )
    except Exception:
        pass  # logging must not break generation

    return result
