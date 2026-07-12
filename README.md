# SocialEngage AI

Multimodal framework for social media content generation and engagement prediction.

## Phases

| Phase | Feature |
|-------|---------|
| 1 | Vite + React frontend, FastAPI `/health` |
| 2 | Image upload, crop, filters, export |
| 3 | Client-side Gemini captions (fallback) |
| 4 | **Multimodal API** — CLIP + Gemini + ML engagement |

## Setup

### Backend (Phase 4 — required for full pipeline)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set GEMINI_API_KEY in backend/.env
uvicorn app.main:app --reload --port 8000
```

First run downloads CLIP weights (~600MB). Allow 1–2 minutes on first caption request.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:8000  (uses backend API)
# VITE_GEMINI_API_KEY=                 (fallback if API unavailable)
npm run dev
```

Open http://localhost:5173 — upload, edit, generate captions.

When `VITE_API_URL` is set, the app calls `POST /api/content/generate` (CLIP + server Gemini + ML ranking). If the backend is offline, it falls back to client-side Gemini.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service check |
| GET | `/api/content/brands` | Brand profile list |
| POST | `/api/content/generate` | Multimodal pipeline (multipart image upload) |
| GET | `/api/analytics/recent` | Recent prediction logs |
| GET | `/api/analytics/stats` | Aggregate stats |
