import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadEditorHandoff, clearEditorHandoff } from '../lib/editorSession';
import { generateSocialContent } from '../lib/generateContent';
import { scoreCaptionViaApi, isApiConfigured } from '../lib/contentApi';
import { formatGeminiError } from '../lib/geminiModels';
import { captionMoodById } from '../lib/captionMoods';
import { brandById } from '../lib/brandProfiles';
import type {
  CaptionScoreResult,
  EngagementComparison,
  EngagementPrediction,
  RankedCaption,
  VisualAnalysis,
} from '../lib/types';
import { AppNav } from '../components/AppNav';

const PIPELINE_STEPS = [
  { id: 'clip', label: 'CLIP visual analysis' },
  { id: 'gemini', label: 'Gemini caption generation' },
  { id: 'rank', label: 'ML engagement ranking' },
] as const;

function formatLikes(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString();
}

function levelClass(level: string): string {
  if (level === 'high') return 'level level--high';
  if (level === 'medium') return 'level level--medium';
  return 'level level--low';
}

function PredictionSummary({ engagement, label }: { engagement: EngagementPrediction; label: string }) {
  return (
    <div className="prediction-trio">
      <div className="prediction-trio__item prediction-trio__item--primary">
        <span className="prediction-trio__label">Predicted likes</span>
        <strong className="prediction-trio__value">{formatLikes(engagement.predicted_likes)}</strong>
      </div>
      <div className="prediction-trio__item">
        <span className="prediction-trio__label">Engagement score</span>
        <strong className="prediction-trio__value">{Math.round(engagement.engagement_score)}/100</strong>
        <span className="prediction-trio__score-hint muted">
          vs top influencer posts — moderate scores are normal
        </span>
      </div>
      <div className="prediction-trio__item">
        <span className="prediction-trio__label">Popularity</span>
        <span className={levelClass(engagement.popularity_level)}>{engagement.popularity_level}</span>
      </div>
      <p className="prediction-trio__hint muted">{label}</p>
    </div>
  );
}

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`collapse ${open ? 'collapse--open' : ''}`}>
      <button
        type="button"
        className="collapse__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="collapse__chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <div className="collapse__body">{children}</div>}
    </section>
  );
}

function PipelineLoading({ activeStep }: { activeStep: number }) {
  return (
    <div className="pipeline-loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <p className="pipeline-loading__title">Running multimodal pipeline…</p>
      <ol className="pipeline-steps">
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < activeStep;
          const current = i === activeStep;
          return (
            <li
              key={step.id}
              className={
                done
                  ? 'pipeline-steps__item pipeline-steps__item--done'
                  : current
                    ? 'pipeline-steps__item pipeline-steps__item--active'
                    : 'pipeline-steps__item'
              }
            >
              <span className="pipeline-steps__mark" aria-hidden>
                {done ? '✓' : current ? '●' : '○'}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="loading-block__hint">First CLIP load can take 30–90s on CPU</p>
    </div>
  );
}

export default function Captions() {
  const navigate = useNavigate();
  const handoff = loadEditorHandoff();

  const [loading, setLoading] = useState(true);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'client' | null>(null);
  const [visual, setVisual] = useState<VisualAnalysis | null>(null);
  const [ranked, setRanked] = useState<RankedCaption[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [predictedLikes, setPredictedLikes] = useState<number | null>(null);
  const [popularityLevel, setPopularityLevel] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [comparison, setComparison] = useState<EngagementComparison | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [ctas, setCtas] = useState<string[]>([]);
  const [marketingTips, setMarketingTips] = useState<string[]>([]);
  const [customCaption, setCustomCaption] = useState('');
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [customScore, setCustomScore] = useState<CaptionScoreResult | null>(null);

  useEffect(() => {
    if (!loading) return;
    setPipelineStep(0);
    const t1 = window.setTimeout(() => setPipelineStep(1), 1800);
    const t2 = window.setTimeout(() => setPipelineStep(2), 5200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loading]);

  useEffect(() => {
    if (!handoff) {
      setError('No edited image. Start from home.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await generateSocialContent(
          handoff.imageBlobUrl,
          handoff.moodId,
          handoff.brandId,
          handoff.contentPath,
          handoff.campaignGoalId,
          handoff.followerCount,
        );
        if (cancelled) return;

        setSource(result.source);
        setVisual(result.visual_analysis ?? null);
        setRanked(result.ranked_captions ?? []);
        setHashtags(result.hashtags);
        setScore(result.engagement?.engagement_score ?? null);
        setPredictedLikes(
          result.engagement?.predicted_likes ??
            (typeof result.engagement?.factors?.predicted_likes === 'number'
              ? result.engagement.factors.predicted_likes
              : null),
        );
        setPopularityLevel(result.engagement?.popularity_level ?? null);
        setTips(result.engagement_tips ?? []);
        setComparison(result.engagement_comparison ?? null);
        setHooks(result.marketing?.hooks ?? []);
        setCtas(result.marketing?.ctas ?? []);
        setMarketingTips(result.marketing?.marketing_tips ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(formatGeminiError(e instanceof Error ? e.message : 'Generation failed'));
        }
      } finally {
        if (!cancelled) {
          setPipelineStep(3);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handoff]);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const scoreMyCaption = async () => {
    if (!handoff || !customCaption.trim()) return;
    if (!isApiConfigured()) {
      setScoreError('Backend API required to score captions.');
      return;
    }

    setScoring(true);
    setScoreError(null);
    try {
      const best = ranked[0];
      const result = await scoreCaptionViaApi(
        handoff.imageBlobUrl,
        customCaption,
        handoff.moodId,
        handoff.brandId,
        handoff.followerCount,
        best?.caption,
        best?.engagement_score,
      );
      setCustomScore(result);
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  if (!handoff && !loading) {
    return (
      <>
        <AppNav />
        <main className="page">
          <div className="empty-state">
            <p>{error}</p>
            <button type="button" className="primary" onClick={() => navigate('/')}>
              Home
            </button>
          </div>
        </main>
      </>
    );
  }

  const mood = captionMoodById(handoff?.moodId);
  const brand = brandById(handoff?.brandId);
  const scoreLabel =
    source === 'api' ? 'ML engagement prediction (Kim-trained GBR)' : 'Engagement score (heuristic)';

  const topEngagement: EngagementPrediction | null =
    score != null && popularityLevel
      ? {
          predicted_likes: predictedLikes,
          engagement_score: score,
          popularity_level: popularityLevel as EngagementPrediction['popularity_level'],
          factors: {},
        }
      : null;

  const best = ranked[0];

  return (
    <>
      <AppNav />
      <main className="page page--captions">
        <header className="page-header">
          <button type="button" className="ghost" onClick={() => navigate('/editor')}>
            ← Back
          </button>
          <div className="page-header__titles">
            <h2>Engagement results</h2>
            <p className="page-header__sub muted">Predictions first · captions ranked by ML</p>
          </div>
        </header>

        {handoff && (
          <div className="captions-hero-meta">
            <img src={handoff.imageBlobUrl} alt="Post" className="captions-thumb" />
            <div className="captions-meta muted">
              <span>
                {mood.label} · {brand.label} ·{' '}
                {handoff.contentPath === 'marketing' ? 'Marketing' : 'Casual'}
                {handoff.followerCount != null ? ` · ${handoff.followerCount.toLocaleString()} followers` : ''}
              </span>
              {source && (
                <span className={`source-badge source-badge--${source}`}>
                  {source === 'api' ? 'CLIP + Gemini + ML' : 'Client fallback'}
                </span>
              )}
            </div>
          </div>
        )}

        {loading && <PipelineLoading activeStep={Math.min(pipelineStep, 2)} />}

        {error && <p className="error">{error}</p>}

        {/* ── Primary: predictions ─────────────────────────── */}
        {!loading && !error && topEngagement && (
          <section className="captions-primary">
            <h3 className="captions-primary__title">Predicted performance</h3>
            <PredictionSummary engagement={topEngagement} label={scoreLabel} />
            {best && (
              <div className="caption-card caption-card--best captions-primary__best">
                <div className="caption-card__meta">
                  <span className="caption-card__badge">ML recommended</span>
                  <span>
                    ~{formatLikes(best.predicted_likes)} likes · {Math.round(best.engagement_score)}/100
                  </span>
                </div>
                <p>{best.caption}</p>
                <button type="button" className="btn-copy" onClick={() => copy(best.caption)}>
                  Copy caption
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Primary: ranked list ─────────────────────────── */}
        {!loading && ranked.length > 0 && (
          <section className="captions-ranked">
            <h3 className="section-title">All ranked captions</h3>
            {ranked.map((item) => (
              <div key={item.rank} className={`caption-card ${item.recommended ? 'caption-card--best' : ''}`}>
                <div className="caption-card__meta">
                  <span>
                    #{item.rank}
                    {item.predicted_likes != null ? ` · ~${formatLikes(item.predicted_likes)} likes` : ''}
                    {' · '}
                    {Math.round(item.engagement_score)}/100
                    {' · '}
                    <span className={levelClass(item.popularity_level)}>{item.popularity_level}</span>
                  </span>
                  {item.recommended && <span className="caption-card__badge">Best</span>}
                </div>
                <p>{item.caption}</p>
                <button type="button" className="btn-copy" onClick={() => copy(item.caption)}>
                  Copy
                </button>
              </div>
            ))}
          </section>
        )}

        {/* ── Primary: score my caption ────────────────────── */}
        {!loading && source === 'api' && handoff && (
          <section className="score-my-caption">
            <h3 className="section-title">Score my caption</h3>
            <p className="muted">
              Paste your own draft — scored with the same Kim-trained model as the ranking above.
            </p>
            <textarea
              className="score-my-caption__input"
              rows={4}
              placeholder="Write or paste your caption here…"
              value={customCaption}
              onChange={(e) => setCustomCaption(e.target.value)}
            />
            <button
              type="button"
              className="primary"
              onClick={scoreMyCaption}
              disabled={scoring || !customCaption.trim()}
            >
              {scoring ? 'Scoring…' : 'Score with ML model'}
            </button>
            {scoreError && <p className="error">{scoreError}</p>}
            {customScore && (
              <div className="score-my-caption__result">
                <PredictionSummary engagement={customScore.engagement} label="Your caption — ML prediction" />
                {customScore.vs_best && (
                  <p className="score-my-caption__delta">
                    vs ML-recommended ({Math.round(customScore.vs_best.best_score)}/100):{' '}
                    <strong>
                      {customScore.vs_best.score_delta >= 0
                        ? `+${customScore.vs_best.score_delta}`
                        : customScore.vs_best.score_delta}
                    </strong>{' '}
                    {customScore.vs_best.score_delta > 0
                      ? 'points below the top-ranked caption'
                      : customScore.vs_best.score_delta < 0
                        ? 'points above the top-ranked caption'
                        : '— same as top-ranked'}
                  </p>
                )}
                {customScore.engagement_tips.length > 0 && (
                  <ul className="tips-list">
                    {customScore.engagement_tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Secondary: collapsible extras ────────────────── */}
        {!loading && !error && (
          <div className="captions-extras">
            <h3 className="section-title">Supporting outputs</h3>

            {comparison && (
              <Collapsible title="Caption optimization (before / after)">
                <p className="muted">
                  {comparison.baseline_label} ({formatLikes(comparison.baseline_likes)} likes ·{' '}
                  {comparison.baseline_score}/100)
                </p>
                <p className="comparison-caption">{comparison.baseline_caption}</p>
                <p className="muted">
                  {comparison.optimized_label} ({formatLikes(comparison.optimized_likes)} likes ·{' '}
                  {comparison.optimized_score}/100)
                </p>
                <p className="comparison-caption comparison-caption--best">{comparison.optimized_caption}</p>
                <p>
                  <strong>Score delta:</strong> +{comparison.score_delta}
                  {comparison.likes_delta != null && (
                    <>
                      {' · '}
                      <strong>Likes delta:</strong> +{comparison.likes_delta.toLocaleString()}
                    </>
                  )}
                </p>
              </Collapsible>
            )}

            {visual && (
              <Collapsible title="CLIP visual analysis">
                <div className="visual-grid">
                  <div className="visual-item">
                    <strong>Scenes</strong>
                    {visual.scene_labels.join(', ') || '—'}
                  </div>
                  <div className="visual-item">
                    <strong>Mood</strong>
                    {visual.dominant_mood}
                  </div>
                  <div className="visual-item">
                    <strong>Objects</strong>
                    {visual.objects_detected.join(', ') || '—'}
                  </div>
                  <div className="visual-item">
                    <strong>Aesthetic</strong>
                    {Math.round(visual.aesthetic_score * 100)}%
                  </div>
                </div>
              </Collapsible>
            )}

            {hashtags.length > 0 && (
              <Collapsible title="Hashtags">
                <div className="hashtag-block">{hashtags.join(' ')}</div>
                <button type="button" onClick={() => copy(hashtags.join(' '))}>
                  Copy all
                </button>
              </Collapsible>
            )}

            {tips.length > 0 && (
              <Collapsible title="Engagement tips">
                <ul className="tips-list">
                  {tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Collapsible>
            )}

            {hooks.length > 0 && (
              <Collapsible title="Hooks">
                <ul className="tips-list">
                  {hooks.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </Collapsible>
            )}

            {ctas.length > 0 && (
              <Collapsible title="CTAs">
                <ul className="tips-list">
                  {ctas.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </Collapsible>
            )}

            {marketingTips.length > 0 && (
              <Collapsible title="Marketing tips">
                <ul className="tips-list">
                  {marketingTips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Collapsible>
            )}
          </div>
        )}

        {source === 'api' && !loading && (
          <p className="dashboard-link">
            <Link to="/dashboard">View this prediction in the analytics dashboard →</Link>
          </p>
        )}

        <div className="page-footer-actions">
          <button
            type="button"
            onClick={() => {
              clearEditorHandoff();
              navigate('/');
            }}
          >
            Start over
          </button>
        </div>
      </main>
    </>
  );
}
