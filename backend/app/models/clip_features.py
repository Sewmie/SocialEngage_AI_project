"""
CLIP feature extraction for engagement training and inference alignment.

Uses the same label sets as image_analyzer.py. When only captions are available
(Instagram analytics CSV), CLIP's text encoder provides scene / mood / aesthetic
proxies — multimodal alignment via shared embedding space.
"""

from __future__ import annotations

from functools import lru_cache

from app.models.image_analyzer import MOOD_LABELS, OBJECT_LABELS, SCENE_LABELS

AESTHETIC_POSITIVE = [
    "aesthetic beautiful high quality instagram photo",
    "professional well composed social media image",
]
AESTHETIC_NEGATIVE = [
    "low quality blurry ugly photo",
    "poorly composed amateur snapshot",
]

BRAND_VOICE_TEXTS = [
    "friendly relatable authentic influencer tone",
    "trustworthy warm community focused small business",
    "refined minimal premium luxury brand voice",
    "professional clear corporate brand communication",
    "bold innovative energetic startup culture",
]


@lru_cache(maxsize=1)
def _load_clip():
    import torch
    from transformers import CLIPModel, CLIPProcessor

    model_name = "openai/clip-vit-base-patch32"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = CLIPProcessor.from_pretrained(model_name)
    model = CLIPModel.from_pretrained(model_name).to(device)
    model.eval()
    return processor, model, device


def _text_embeddings(texts: list[str]):
    import torch
    import torch.nn.functional as F

    processor, model, device = _load_clip()
    inputs = processor(
        text=texts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=77,
    ).to(device)
    with torch.no_grad():
        text_outputs = model.text_model(
            input_ids=inputs["input_ids"],
            attention_mask=inputs.get("attention_mask"),
        )
        feats = model.text_projection(text_outputs.pooler_output)
        feats = F.normalize(feats, dim=-1)
    return feats


def _rank_caption_against_labels(caption: str, labels: list[str], top_k: int = 3) -> list[tuple[str, float]]:
    import torch

    if not caption.strip():
        return [(labels[0], 0.25)] if labels else []

    caption_feat = _text_embeddings([caption])[0:1]
    label_feats = _text_embeddings(labels)
    with torch.no_grad():
        logits = (caption_feat @ label_feats.T) * 100.0
        probs = logits.softmax(dim=-1).cpu().numpy()[0]
    ranked = sorted(zip(labels, probs.tolist()), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]


def _aesthetic_from_caption(caption: str) -> float:
    import torch

    if not caption.strip():
        return 0.5

    caption_feat = _text_embeddings([caption])[0:1]
    pos_feats = _text_embeddings(AESTHETIC_POSITIVE)
    neg_feats = _text_embeddings(AESTHETIC_NEGATIVE)
    refs = torch.cat([pos_feats, neg_feats], dim=0)
    with torch.no_grad():
        logits = (caption_feat @ refs.T) * 100.0
        probs = logits.softmax(dim=-1).cpu().numpy()[0]
    pos_mass = float(probs[: len(AESTHETIC_POSITIVE)].sum())
    return round(min(1.0, max(0.0, pos_mass)), 4)


def _brand_fit_from_caption(caption: str) -> float:
    import torch

    if not caption.strip():
        return 0.65

    caption_feat = _text_embeddings([caption])[0:1]
    brand_feats = _text_embeddings(BRAND_VOICE_TEXTS)
    with torch.no_grad():
        sims = (caption_feat @ brand_feats.T).cpu().numpy()[0]
    best = float(sims.max())
    # cosine in [-1, 1] → [0, 1]
    return round(min(1.0, max(0.0, (best + 1) / 2)), 4)


def extract_caption_features(caption: str) -> dict:
    """CLIP text-side features aligned with inference-time image_analyzer outputs."""
    scenes = _rank_caption_against_labels(caption, SCENE_LABELS, top_k=3)
    moods = _rank_caption_against_labels(caption, MOOD_LABELS, top_k=1)
    objects = _rank_caption_against_labels(caption, OBJECT_LABELS, top_k=4)

    top_conf = scenes[0][1] if scenes else 0.4
    spread = sum(s[1] for s in scenes[:2])
    aesthetic_score = _aesthetic_from_caption(caption)
    # Blend caption aesthetic prompts with scene clarity (matches image_analyzer formula)
    aesthetic_blended = round(
        min(1.0, max(0.0, 0.55 * aesthetic_score + 0.25 * top_conf + 0.20 * spread)),
        4,
    )

    return {
        "aesthetic_score": aesthetic_blended,
        "scene_confidence": round(top_conf, 4),
        "mood_match": round(moods[0][1] if moods else 0.65, 4),
        "brand_fit": _brand_fit_from_caption(caption),
        "dominant_mood": moods[0][0] if moods else "neutral",
        "top_scene": scenes[0][0] if scenes else "",
        "objects_detected": [o[0] for o in objects if o[1] > 0.12],
    }


def extract_image_features(image_bytes: bytes) -> dict:
    """Delegate to image_analyzer for posts with image files."""
    from app.models.image_analyzer import analyze_image

    visual = analyze_image(image_bytes)
    scene_scores = visual.get("scene_scores") or {}
    top_scene_conf = max(scene_scores.values()) if scene_scores else 0.4
    return {
        "aesthetic_score": float(visual.get("aesthetic_score", 0.5)),
        "scene_confidence": round(float(top_scene_conf), 4),
        "mood_match": 0.65,
        "brand_fit": _brand_fit_from_caption(""),
        "dominant_mood": visual.get("dominant_mood", "neutral"),
        "top_scene": (visual.get("scene_labels") or [""])[0],
        "objects_detected": visual.get("objects_detected") or [],
    }
