"""Content generation endpoints."""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.models.brand_engine import list_brands
from app.models.fusion import generate_multimodal_content
from app.schemas.content import ContentGenerateResponse

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("/brands")
def get_brands():
    return {"brands": list_brands()}


@router.post("/generate", response_model=ContentGenerateResponse)
async def generate_content(
    image: UploadFile = File(...),
    filter_name: str = Form(default="Original"),
    mood_id: str = Form(default="chill"),
    brand_id: str = Form(default="casual_creator"),
    content_path: str = Form(default="marketing"),
    campaign_goal_id: str = Form(default="awareness"),
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
            filter_name=filter_name,
            mood_id=mood_id,
            brand_id=brand_id,
            gemini_api_key=settings.gemini_api_key,
            content_path=content_path,
            campaign_goal_id=campaign_goal_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}") from e
