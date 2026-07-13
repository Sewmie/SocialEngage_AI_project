"""Transformer-based caption and hashtag generation via Gemini."""

from __future__ import annotations

import json
import re

import google.generativeai as genai

from app.models.brand_engine import get_brand

MOOD_TONES: dict[str, str] = {
    "chill": "relaxed, unbothered, soft flex",
    "cozy": "warm, homey, comfort-first",
    "romantic": "tender, dreamy, poetic",
    "bold": "confident, main-character energy",
    "funny": "playful, witty, light chaos",
    "nostalgic": "wistful, memory-lane",
    "travel": "adventure, discovery",
    "nightout": "party, city lights, hype",
    "aesthetic": "curated feed, moodboard calm",
    "real": "honest, grounded, vulnerable",
    "professional": "polished, credible, brand-safe, clear value",
    "promotional": "urgency, offers, conversion-focused",
    "educational": "helpful tips, expertise, save-worthy",
    "inspirational": "motivating, uplifting, aspirational",
    "community": "local pride, togetherness, support-local warmth",
    "luxury": "premium, refined, understated exclusivity",
    "festive": "celebration, events, joyful occasion",
    "minimal": "short, clean, one-liner impact",
    "storytelling": "narrative hook, behind-the-scenes, brand story",
    "trust": "social proof, transparent, customer-first reassurance",
}

CAMPAIGN_GOALS: dict[str, str] = {
    "awareness": "build recognition, tell brand story, memorable positioning",
    "promotion": "drive urgency, highlight offer or discount, clear value proposition",
    "product": "showcase features, benefits, why buy now",
    "lead": "encourage DM, link in bio, sign-up or booking",
    "community": "humanize brand, social proof, customer-centric warmth",
}


def _strip_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        return re.sub(r"^```(?:json)?\s*", "", t, flags=re.I).rstrip("`").strip()
    return t


def _parse_result(raw: str, content_path: str) -> dict:
    parsed = json.loads(_strip_fence(raw))
    captions = [str(c).strip() for c in parsed.get("captions", []) if str(c).strip()][:10]
    hashtags = [str(h).strip() for h in parsed.get("hashtags", []) if str(h).strip()]
    hashtags = [h if h.startswith("#") else f"#{h}" for h in hashtags]
    max_tags = 15 if content_path == "marketing" else 8
    hashtags = hashtags[:max_tags]

    out: dict = {"captions": captions, "hashtags": hashtags}
    if content_path == "marketing":
        out["hooks"] = [str(x).strip() for x in parsed.get("hooks", []) if str(x).strip()][:5]
        out["ctas"] = [str(x).strip() for x in parsed.get("ctas", []) if str(x).strip()][:5]
        out["marketing_tips"] = [
            str(x).strip() for x in parsed.get("marketing_tips", []) if str(x).strip()
        ][:4]
    return out


def _build_prompt(
    visual: dict,
    mood_id: str,
    brand_id: str,
    content_path: str = "marketing",
    campaign_goal_id: str = "awareness",
) -> str:
    brand = get_brand(brand_id)
    mood_tone = MOOD_TONES.get(mood_id, MOOD_TONES["chill"])
    scenes = ", ".join(visual.get("scene_labels", []))
    objects = ", ".join(visual.get("objects_detected", []))
    dom_mood = visual.get("dominant_mood", "")

    visual_block = f"""VISUAL ANALYSIS (CLIP):
- Scenes: {scenes}
- Objects: {objects}
- Dominant mood: {dom_mood}
- Aesthetic score: {visual.get("aesthetic_score", 0.5)}"""

    if content_path == "casual":
        return f"""You write casual Instagram captions for personal posts (NOT corporate marketing).

{visual_block}
Mood: "{mood_id}" ({mood_tone})

Return ONLY valid JSON:
{{
  "captions": ["...", ... exactly 10 casual strings],
  "hashtags": ["#tag1", ... 5 to 8 light tags]
}}

Rules:
- Personal, authentic, Gen-Z friendly; reference what's in the photo
- No sales pitch, no corporate speak, no "link in bio" unless natural
- Under 180 chars each; varied tone across the 10
- No markdown outside JSON"""

    goal = CAMPAIGN_GOALS.get(campaign_goal_id, CAMPAIGN_GOALS["awareness"])
    return f"""You are an expert social media marketing strategist for Instagram.

{visual_block}

MARKETING CONTEXT:
- Content tone: "{mood_id}" ({mood_tone})
- Brand: {brand["label"]} — {brand["voice"]}
- Campaign goal: {campaign_goal_id} — {goal}
- Hashtag strategy: {brand["hashtag_style"]}
- CTA style: {brand["cta"]}

Generate professional MARKETING content optimized for engagement and conversions.

Return ONLY valid JSON:
{{
  "captions": ["...", ... exactly 10 strategic marketing captions],
  "hashtags": ["#tag1", ... 12 to 15 optimized tags],
  "hooks": ["...", ... 5 scroll-stopping opening lines for Reels/carousel covers],
  "ctas": ["...", ... 5 call-to-action lines],
  "marketing_tips": ["...", ... 3 short tips to improve this post's performance]
}}

Rules:
- Captions: value-driven, brand-aligned, include subtle persuasion; under 220 chars
- Hooks: punchy first lines that stop the scroll
- CTAs: action-oriented (shop, DM, save, share, visit)
- Hashtags: mix branded, niche, local (#srilanka #lka when relevant)
- Safe, inclusive; no markdown outside JSON"""


def generate_text_content(
    image_bytes: bytes,
    mime_type: str,
    visual: dict,
    mood_id: str,
    brand_id: str,
    api_key: str,
    content_path: str = "marketing",
    campaign_goal_id: str = "awareness",
) -> dict:
    if not api_key.strip():
        raise ValueError("GEMINI_API_KEY is not configured on the server.")

    genai.configure(api_key=api_key.strip())
    prompt = _build_prompt(
        visual, mood_id, brand_id, content_path, campaign_goal_id
    )

    models = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3-flash-preview"]
    last_err: Exception | None = None

    for name in models:
        try:
            model = genai.GenerativeModel(name)
            result = model.generate_content(
                [
                    {"text": prompt},
                    {"mime_type": mime_type, "data": image_bytes},
                ]
            )
            out = _parse_result(result.text or "", content_path)
            if out.get("captions"):
                return out
        except Exception as e:
            last_err = e

    raise last_err or RuntimeError("NLP module failed to generate content.")
