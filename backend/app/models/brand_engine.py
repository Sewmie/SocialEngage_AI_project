"""Brand personality profiles for caption / hashtag conditioning."""

BRAND_PROFILES: dict[str, dict] = {
    "casual_creator": {
        "label": "Casual creator",
        "voice": "friendly, relatable, Gen Z, lowercase ok, authentic influencer tone",
        "hashtag_style": "mix of niche and trending, 8–12 tags, include #srilanka when relevant",
        "cta": "soft engagement ask (save, share vibe)",
    },
    "local_sme": {
        "label": "Local SME",
        "voice": "trustworthy small business, warm, community-focused, clear value",
        "hashtag_style": "local + industry tags, #lka #colombo style when fitting, 10–15 tags",
        "cta": "visit us, DM to order, support local",
    },
    "luxury_brand": {
        "label": "Luxury brand",
        "voice": "refined, minimal words, premium, understated confidence",
        "hashtag_style": "curated premium tags, fewer but high-quality, 5–8 tags",
        "cta": "discover collection, exclusive",
    },
    "corporate": {
        "label": "Corporate",
        "voice": "professional, clear, brand-safe, inclusive, no slang overload",
        "hashtag_style": "industry and campaign hashtags, 8–12 tags",
        "cta": "learn more, link in bio, team spotlight",
    },
    "youth_startup": {
        "label": "Youth startup",
        "voice": "bold, innovative, energetic, startup culture, future-forward",
        "hashtag_style": "tech + startup + local innovation tags, 10–14 tags",
        "cta": "join the movement, early access",
    },
}


def get_brand(brand_id: str) -> dict:
    return BRAND_PROFILES.get(brand_id, BRAND_PROFILES["casual_creator"])


def list_brands() -> list[dict]:
    return [{"id": k, "label": v["label"]} for k, v in BRAND_PROFILES.items()]
