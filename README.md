# SocialEngage AI

Multimodal framework for Instagram content generation and **engagement prediction** — predicts **likes**, **engagement score (0–100)**, and **popularity level** using a Kim-trained Gradient Boosting model.

Full project documentation: see `[fyp/docs/PROJECT.md](../../fyp/docs/PROJECT.md)` (architecture, training, dissertation links).

---

## Phases


| Phase | Feature                                                  |
| ----- | -------------------------------------------------------- |
| 1     | Vite + React frontend, FastAPI `/health`                 |
| 2     | Image upload, crop, editor                               |
| 3     | Client-side Gemini captions (fallback)                   |
| 4     | Multimodal API — CLIP + Gemini + ML ranking              |
| 5     | Analytics dashboard — prediction history + model metrics |
| 6     | Kim dataset training, follower feature, dual likes model |
| 7     | Score my caption, feature importance                     |
| 8–9   | Dual likes model, UI prediction trio                     |
| **10** | **UI polish — drag crop, Captions hierarchy, pipeline loading** |


---



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

Open **[http://localhost:5173](http://localhost:5173)**

---



## Routes


| Path         | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| `/`          | Upload & start analysis                                     |
| `/editor`    | Crop, brand/mood/followers                                  |
| `/captions`  | Ranked captions + likes/score/popularity + Score my caption |
| `/dashboard` | R²/MAE, feature importance, prediction history              |


---



## API


| Method | Path                           | Description                             |
| ------ | ------------------------------ | --------------------------------------- |
| GET    | `/health`                      | Service check                           |
| POST   | `/api/content/generate`        | Full multimodal pipeline                |
| POST   | `/api/content/score-caption`   | Score user-provided caption             |
| GET    | `/api/analytics/stats`         | Aggregate stats                         |
| GET    | `/api/analytics/recent`        | Recent prediction logs                  |
| GET    | `/api/analytics/model-metrics` | R², MAE, likes MAE, feature importances |


Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Predictions log to `backend/data/analytics.db` (metadata only, no images).

---



## Model metrics


| Metric         | Value              |
| -------------- | ------------------ |
| Engagement R²  | 0.603              |
| Engagement MAE | 4.46               |
| Likes MAE      | 1,485              |
| Training posts | 9,883 (Kim WWW'20) |


Bundle: `backend/models/engagement.joblib`

---



## Project docs


| File              | Location                                   |
| ----------------- | ------------------------------------------ |
| Project overview  | `fyp/docs/PROJECT.md`                      |
| Dissertation      | `fyp/docs/DISSERTATION_SOCIALENGAGE_AI.md` |
| Kim dataset guide | `fyp/docs/KIM_HYBRID_DATASET.md`           |
| Viva prep         | `fyp/docs/VIVA_DEFENCE.md`                 |


