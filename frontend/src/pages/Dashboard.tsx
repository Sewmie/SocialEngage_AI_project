import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppNav } from '../components/AppNav';
import {
  fetchModelMetrics,
  fetchPredictionStats,
  fetchRecentPredictions,
  isAnalyticsConfigured,
  type ModelMetrics,
  type PredictionLog,
  type PredictionStats,
} from '../lib/analyticsApi';
import { MODEL_STATS, PIPELINE_MODULES } from '../lib/branding';
import { brandById } from '../lib/brandProfiles';
import { captionMoodById } from '../lib/captionMoods';
import '../styles/dashboard.css';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function levelClass(level: string): string {
  if (level === 'high') return 'level level--high';
  if (level === 'medium') return 'level level--medium';
  return 'level level--low';
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [predictions, setPredictions] = useState<PredictionLog[]>([]);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);

  const load = useCallback(async () => {
    if (!isAnalyticsConfigured()) {
      setError('Set VITE_API_URL in frontend/.env and start the backend.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [s, p, m] = await Promise.all([
        fetchPredictionStats(),
        fetchRecentPredictions(25),
        fetchModelMetrics(),
      ]);
      setStats(s);
      setPredictions(p);
      setModelMetrics(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayR2 = modelMetrics?.r2 != null ? modelMetrics.r2.toFixed(2) : MODEL_STATS.r2;
  const displayMae = modelMetrics?.mae != null ? modelMetrics.mae.toFixed(2) : MODEL_STATS.mae;
  const displayTrain = modelMetrics?.n_train ?? MODEL_STATS.dataset;
  const displayTest = modelMetrics?.n_test ?? '24';

  return (
    <>
      <AppNav />
      <main className="page page--wide dashboard">
        <header className="dashboard__header">
          <div>
            <p className="dashboard__kicker">Phase 5 · Analytics</p>
            <h1>Engagement dashboard</h1>
            <p className="muted">Live prediction history + trained model evaluation metrics</p>
          </div>
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </header>

        {loading && (
          <div className="loading-block">
            <div className="spinner" aria-hidden />
            <p>Loading analytics…</p>
          </div>
        )}
        {error && <p className="error">{error}</p>}

        {!loading && !error && (
          <>
            <section className="metrics-strip">
              <div className="metric-card">
                <span className="metric-card__label">R² score</span>
                <strong className="metric-card__value">{displayR2}</strong>
                <span className="metric-card__hint">Hold-out test set</span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">MAE</span>
                <strong className="metric-card__value">{displayMae}</strong>
                <span className="metric-card__hint">Mean absolute error</span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">Training set</span>
                <strong className="metric-card__value">{displayTrain}</strong>
                <span className="metric-card__hint">Instagram posts</span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">Test set</span>
                <strong className="metric-card__value">{displayTest}</strong>
                <span className="metric-card__hint">80/20 split</span>
              </div>
            </section>

            <section className="stats-grid">
              <div className="stat-card">
                <span className="stat-card__label">Total predictions</span>
                <strong className="stat-card__value">{stats?.total_predictions ?? 0}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-card__label">Average top score</span>
                <strong className="stat-card__value">
                  {stats?.avg_top_score != null ? `${stats.avg_top_score}/100` : '—'}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-card__label">Score range</span>
                <strong className="stat-card__value">
                  {stats?.min_top_score != null && stats?.max_top_score != null
                    ? `${stats.min_top_score} – ${stats.max_top_score}`
                    : '—'}
                </strong>
              </div>
            </section>

            <section className="dashboard__section">
              <h2>Pipeline modules</h2>
              <div className="module-grid">
                {PIPELINE_MODULES.map((m) => (
                  <article key={m.id} className={`module-card ${m.id === 'analytics' ? 'module-card--active' : ''}`}>
                    <h3>{m.title}</h3>
                    <p className="module-card__tech">{m.tech}</p>
                    <p className="module-card__desc">{m.desc}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboard__section">
              <div className="dashboard__section-head">
                <h2>Recent predictions</h2>
                <p className="muted">Logged automatically after each API generation</p>
              </div>

              {predictions.length === 0 ? (
                <div className="empty-state">
                  <p>No predictions logged yet.</p>
                  <Link to="/" className="btn-primary">Create your first post analysis</Link>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="predictions-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Score</th>
                        <th>Brand / mood</th>
                        <th>Path</th>
                        <th>Top caption</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((p) => (
                        <tr key={p.id}>
                          <td className="predictions-table__date">{formatDate(p.created_at)}</td>
                          <td>
                            <span className={levelClass(p.popularity_level)}>
                              {Math.round(p.top_score)}
                            </span>
                          </td>
                          <td>
                            {brandById(p.brand_id).label}
                            <br />
                            <span className="muted">{captionMoodById(p.mood_id).label}</span>
                          </td>
                          <td>{p.content_path}</td>
                          <td className="predictions-table__caption">{p.top_caption}</td>
                          <td>{p.score_delta != null ? `+${p.score_delta}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {modelMetrics?.clip_features && (
              <p className="dashboard__footnote muted">
                Model trained with CLIP-enriched text features · {MODEL_STATS.model}
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}
