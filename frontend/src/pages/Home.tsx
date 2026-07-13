import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { AppNav } from '../components/AppNav';
import { fetchModelMetrics, isAnalyticsConfigured, type ModelMetrics } from '../lib/analyticsApi';
import { APP_NAME, APP_TAGLINE, MODEL_STATS } from '../lib/branding';

export default function Home() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);

  useEffect(() => {
    if (!isAnalyticsConfigured()) return;
    fetchModelMetrics()
      .then(setModelMetrics)
      .catch(() => {});
  }, []);

  const displayPosts =
    modelMetrics?.n_dataset != null
      ? modelMetrics.n_dataset.toLocaleString()
      : modelMetrics?.n_train != null
        ? modelMetrics.n_train.toLocaleString()
        : MODEL_STATS.dataset;
  const displayR2 =
    modelMetrics?.r2 != null ? modelMetrics.r2.toFixed(2) : MODEL_STATS.r2;

  const onFile = (file: File) => {
    const url = URL.createObjectURL(file);
    navigate('/editor', { state: { imageUrl: url, fileName: file.name } });
  };

  return (
    <div className="hero">
      <AppNav />
      <main className="hero__content">
        <span className="hero__badge">Multimodal ML · CLIP + Gemini</span>
        <h1 className="hero__title">{APP_NAME}</h1>
        <p className="hero__tagline">{APP_TAGLINE}</p>

        <div className="hero__stats">
          <div className="stat-pill">
            <span className="stat-pill__value">{displayPosts}</span>
            <span className="stat-pill__label">Posts trained</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill__value">R² {displayR2}</span>
            <span className="stat-pill__label">Model accuracy</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill__value">{MODEL_STATS.model.split(' ')[0]}</span>
            <span className="stat-pill__label">+ Gradient Boost</span>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />

        <div className="hero__actions">
          <button type="button" className="primary btn-lg" onClick={() => inputRef.current?.click()}>
            Choose photo
          </button>
          <button type="button" className="btn-lg" onClick={() => navigate('/dashboard')}>
            View analytics
          </button>
        </div>
      </main>
    </div>
  );
}
