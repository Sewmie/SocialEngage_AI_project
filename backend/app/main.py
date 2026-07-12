"""FastAPI entry — Multimodal Social Media Content API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.analytics import router as analytics_router
from app.api.routes.content import router as content_router
from app.db.analytics import init_db

app = FastAPI(
    title="Multimodal Social Content API",
    description=(
        "CLIP image analysis + Gemini captions/hashtags + brand conditioning "
        "+ engagement prediction for FYP research framework."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(content_router)
app.include_router(analytics_router)


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "multimodal-content-api", "phase": 4}
