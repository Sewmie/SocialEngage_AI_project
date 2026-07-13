# SocialEngage AI

Multimodal framework for social media content generation and engagement prediction.

## Phases

| Phase | Feature |
|-------|---------|
| 1 | Vite + React frontend, FastAPI `/health` |
| 2 | Image upload, crop, export |
| 3 | Client-side Gemini captions (fallback) |
| 4 | Multimodal API — CLIP + Gemini + ML engagement |
| 5 | **Analytics dashboard** — prediction history + model metrics |

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set GEMINI_API_KEY in backend/.env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173

## Routes

| Path | Description |
|------|-------------|
| `/` | Upload & start analysis |
| `/editor` | Crop, brand/mood config |
| `/captions` | Generated content + engagement score |
| `/dashboard` | Analytics — live logs + R²/MAE metrics |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service check |
| POST | `/api/content/generate` | Multimodal pipeline |
| GET | `/api/analytics/stats` | Aggregate prediction stats |
| GET | `/api/analytics/recent` | Recent prediction logs |
| GET | `/api/analytics/model-metrics` | Trained model R², MAE, train/test split |

Predictions are logged to SQLite (`backend/data/analytics.db`) after each API generation.
