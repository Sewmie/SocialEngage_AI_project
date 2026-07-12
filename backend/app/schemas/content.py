"""Request/response schemas for the content generation API."""

from pydantic import BaseModel, Field


class VisualAnalysis(BaseModel):
    scene_labels: list[str] = Field(default_factory=list)
    dominant_mood: str = ""
    aesthetic_score: float = Field(ge=0, le=1, description="0–1 proxy from CLIP confidence spread")
    objects_detected: list[str] = Field(default_factory=list)


class EngagementPrediction(BaseModel):
    engagement_score: float = Field(ge=0, le=100, description="Predicted engagement index 0–100")
    popularity_level: str = Field(description="low | medium | high")
    factors: dict[str, float] = Field(default_factory=dict)


class RankedCaption(BaseModel):
    caption: str
    engagement_score: float = Field(ge=0, le=100)
    popularity_level: str
    rank: int = Field(ge=1)
    recommended: bool = False
    factors: dict[str, float] = Field(default_factory=dict)


class EngagementComparison(BaseModel):
    baseline_label: str
    baseline_caption: str
    baseline_score: float = Field(ge=0, le=100)
    optimized_label: str
    optimized_caption: str
    optimized_score: float = Field(ge=0, le=100)
    score_delta: float


class MarketingExtras(BaseModel):
    hooks: list[str] = Field(default_factory=list)
    ctas: list[str] = Field(default_factory=list)
    marketing_tips: list[str] = Field(default_factory=list)


class ContentGenerateResponse(BaseModel):
    captions: list[str]
    ranked_captions: list[RankedCaption] = Field(default_factory=list)
    hashtags: list[str]
    visual_analysis: VisualAnalysis
    engagement: EngagementPrediction | None = None
    engagement_tips: list[str] = Field(default_factory=list)
    engagement_comparison: EngagementComparison | None = None
    marketing: MarketingExtras | None = None
    brand_id: str
    mood_id: str
    filter_name: str
    content_path: str = "marketing"
