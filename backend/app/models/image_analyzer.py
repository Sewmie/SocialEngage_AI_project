"""CLIP-based image understanding (scene, objects, aesthetic proxy)."""

from __future__ import annotations

import io
from functools import lru_cache

from PIL import Image

# Zero-shot labels aligned with social / marketing context
SCENE_LABELS = [
    "outdoor landscape",
    "city street at night",
    "coffee shop interior",
    "beach vacation",
    "food and dining",
    "fashion portrait",
    "fitness workout",
    "wedding celebration",
    "product showcase",
    "office workspace",
    "nature hike",
    "party event",
]

OBJECT_LABELS = [
    "person",
    "food",
    "drink",
    "phone",
    "laptop",
    "car",
    "building",
    "sunset sky",
    "flowers",
    "pet animal",
]

MOOD_LABELS = [
    "happy cheerful",
    "calm peaceful",
    "romantic dreamy",
    "energetic exciting",
    "nostalgic melancholic",
    "professional corporate",
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


def _rank_labels(image: Image.Image, labels: list[str], top_k: int = 3) -> list[tuple[str, float]]:
    import torch

    processor, model, device = _load_clip()
    inputs = processor(text=labels, images=image, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        outputs = model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1).cpu().numpy()[0]
    ranked = sorted(zip(labels, probs.tolist()), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]


def analyze_image(image_bytes: bytes) -> dict:
    """Extract visual features using CLIP zero-shot classification."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    scenes = _rank_labels(image, SCENE_LABELS, top_k=3)
    objects = _rank_labels(image, OBJECT_LABELS, top_k=4)
    moods = _rank_labels(image, MOOD_LABELS, top_k=1)

    scene_labels = [s[0] for s in scenes]
    objects_detected = [o[0] for o in objects if o[1] > 0.12]
    dominant_mood = moods[0][0] if moods else "neutral"

    # Aesthetic proxy: higher top-1 confidence + moderate entropy → cleaner composition cue
    top_conf = scenes[0][1] if scenes else 0.5
    spread = sum(s[1] for s in scenes[:2])
    aesthetic_score = round(min(1.0, max(0.0, 0.45 * top_conf + 0.35 * spread + 0.2)), 3)

    return {
        "scene_labels": scene_labels,
        "dominant_mood": dominant_mood,
        "aesthetic_score": aesthetic_score,
        "objects_detected": objects_detected,
        "scene_scores": {s[0]: round(s[1], 4) for s in scenes},
    }
