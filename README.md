# SocialEngage AI

Multimodal framework for social media content generation and engagement prediction.

## Phase 3 — React + Gemini captions

- **Phase 1:** Vite + React frontend, FastAPI `/health`
- **Phase 2:** Image upload, crop, filters, export
- **Phase 3:** Client-side Gemini caption + hashtag generation

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_GEMINI_API_KEY in frontend/.env
npm run dev
```

Open http://localhost:5173 — upload an image, configure tone/brand, then generate captions.
