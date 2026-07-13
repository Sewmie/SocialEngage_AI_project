"""Content generation endpoints."""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.models.brand_engine import list_brands
from app.models.fusion import generate_multimodal_content, score_caption_for_image
from app.schemas.content import CaptionScoreResponse, ContentGenerateResponse

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("/brands")
def get_brands():
    return {"brands": list_brands()}


@router.post("/generate", response_model=ContentGenerateResponse)
async def generate_content(
    image: UploadFile = File(...),
    mood_id: str = Form(default="chill"),
    brand_id: str = Form(default="casual_creator"),
    content_path: str = Form(default="marketing"),
    campaign_goal_id: str = Form(default="awareness"),
    follower_count: int = Form(default=0),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload must be an image file.")

    data = await image.read()
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Image file is empty or too small.")

    try:
        result = generate_multimodal_content(
            image_bytes=data,
            mime_type=image.content_type or "image/jpeg",
            mood_id=mood_id,
            brand_id=brand_id,
            gemini_api_key=settings.gemini_api_key,
            content_path=content_path,
            campaign_goal_id=campaign_goal_id,
            follower_count=follower_count if follower_count > 0 else None,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}") from e


@router.post("/score-caption", response_model=CaptionScoreResponse)
async def score_caption(
    image: UploadFile = File(...),
    caption: str = Form(...),
    mood_id: str = Form(default="chill"),
    brand_id: str = Form(default="casual_creator"),
    follower_count: int = Form(default=0),
    best_caption: str = Form(default=""),
    best_score: float = Form(default=0),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload must be an image file.")

    data = await image.read()
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Image file is empty or too small.")

    text = caption.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Caption cannot be empty.")

    try:
        return score_caption_for_image(
            image_bytes=data,
            caption=text,
            mood_id=mood_id,
            brand_id=brand_id,
            follower_count=follower_count if follower_count > 0 else None,
            best_caption=best_caption.strip() or None,
            best_score=best_score if best_score > 0 else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}") from e
