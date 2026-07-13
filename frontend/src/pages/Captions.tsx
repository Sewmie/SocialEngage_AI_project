import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadEditorHandoff, clearEditorHandoff } from '../lib/editorSession';
import { generateSocialContent } from '../lib/generateContent';
import { scoreCaptionViaApi, isApiConfigured } from '../lib/contentApi';
import { formatGeminiError } from '../lib/geminiModels';
import { captionMoodById } from '../lib/captionMoods';
import { brandById } from '../lib/brandProfiles';
import type { CaptionScoreResult, EngagementComparison, EngagementPrediction, RankedCaption, VisualAnalysis } from '../lib/types';
import { AppNav } from '../components/AppNav';

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

export default function Captions() {
  const navigate = useNavigate();
  const handoff = loadEditorHandoff();

  const [loading, setLoading] = useState(true);
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
          result.engagement?.predicted_likes
          ?? (typeof result.engagement?.factors?.predicted_likes === 'number'
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
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
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
            <button type="button" className="primary" onClick={() => navigate('/')}>Home</button>
          </div>
        </main>
      </>
    );
  }

  const mood = captionMoodById(handoff?.moodId);
  const brand = brandById(handoff?.brandId);
  const scoreLabel = source === 'api'
    ? 'ML engagement prediction (Kim-trained GBR)'
    : 'Engagement score (heuristic)';

  const topEngagement: EngagementPrediction | null =
    score != null && popularityLevel
      ? {
          predicted_likes: predictedLikes,
          engagement_score: score,
          popularity_level: popularityLevel as EngagementPrediction['popularity_level'],
          factors: {},
        }
      : null;

  return (
    <>
      <AppNav />
      <main className="page">
        <header className="page-header">
          <button type="button" className="ghost" onClick={() => navigate('/editor')}>← Back</button>
          <h2>Generated content</h2>
        </header>

        {handoff && (
          <img src={handoff.imageBlobUrl} alt="Post" className="captions-thumb" />
        )}

        <div className="captions-meta muted">
          <span>{mood.label} · {brand.label} · {handoff?.contentPath === 'marketing' ? 'Marketing' : 'Casual'}</span>
          {source && (
            <span className={`source-badge source-badge--${source}`}>
              {source === 'api' ? 'CLIP + Gemini + ML' : 'Client fallback'}
            </span>
          )}
        </div>

        {loading && (
          <div className="loading-block">
            <div className="spinner" aria-hidden />
            <p>Running multimodal pipeline…</p>
            <p className="loading-block__hint">
              CLIP analysis + Gemini captions + ML ranking (30–90s on first run)
            </p>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {!loading && visual && (
          <section className="visual-card">
            <h3>CLIP visual analysis</h3>
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
          </section>
        )}

        {!loading && !error && topEngagement && (
          <PredictionSummary engagement={topEngagement} label={scoreLabel} />
        )}

        {!loading && comparison && (
          <section className="comparison-card">
            <h3>Caption optimization</h3>
            <p className="muted">
              {comparison.baseline_label}
              {' '}
              ({formatLikes(comparison.baseline_likes)} likes · {comparison.baseline_score}/100)
            </p>
            <p className="comparison-caption">{comparison.baseline_caption}</p>
            <p className="muted">
              {comparison.optimized_label}
              {' '}
              ({formatLikes(comparison.optimized_likes)} likes · {comparison.optimized_score}/100)
            </p>
            <p className="comparison-caption comparison-caption--best">{comparison.optimized_caption}</p>
            <p><strong>Score delta:</strong> +{comparison.score_delta}</p>
            {comparison.likes_delta != null && (
              <p><strong>Likes delta:</strong> +{comparison.likes_delta.toLocaleString()}</p>
            )}
          </section>
        )}

        {!loading && ranked.length > 0 && (
          <section>
            <h3 className="section-title">Ranked captions</h3>
            {ranked.map((item) => (
              <div key={item.rank} className={`caption-card ${item.recommended ? 'caption-card--best' : ''}`}>
                <div className="caption-card__meta">
                  <span>
                    #{item.rank}
                    {item.predicted_likes != null ? ` · ~${formatLikes(item.predicted_likes)} likes` : ''}
                    {' · '}{Math.round(item.engagement_score)}/100
                    {' · '}
                    <span className={levelClass(item.popularity_level)}>{item.popularity_level}</span>
                  </span>
                  {item.recommended && <span className="caption-card__badge">Recommended</span>}
                </div>
                <p>{item.caption}</p>
                <button type="button" className="btn-copy" onClick={() => copy(item.caption)}>Copy</button>
              </div>
            ))}
          </section>
        )}

        {!loading && source === 'api' && handoff && (
          <section className="score-my-caption">
            <h3 className="section-title">Score my caption</h3>
            <p className="muted">
              Paste your own draft — the ML model scores it with the same features as the ranked captions.
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
              className="btn-primary"
              onClick={scoreMyCaption}
              disabled={scoring || !customCaption.trim()}
            >
              {scoring ? 'Scoring…' : 'Score with ML model'}
            </button>
            {scoreError && <p className="error">{scoreError}</p>}
            {customScore && (
              <div className="score-my-caption__result">
                <PredictionSummary
                  engagement={customScore.engagement}
                  label="Your caption — ML prediction"
                />
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
                    {customScore.engagement_tips.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {!loading && hashtags.length > 0 && (
          <section>
            <h3 className="section-title">Hashtags</h3>
            <div className="hashtag-block">{hashtags.join(' ')}</div>
            <button type="button" onClick={() => copy(hashtags.join(' '))}>Copy all</button>
          </section>
        )}

        {!loading && tips.length > 0 && (
          <section className="panel">
            <h3 className="section-title">Tips</h3>
            <ul className="tips-list">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        )}

        {!loading && hooks.length > 0 && (
          <section className="panel">
            <h3 className="section-title">Hooks</h3>
            <ul className="tips-list">{hooks.map((h) => <li key={h}>{h}</li>)}</ul>
          </section>
        )}

        {!loading && ctas.length > 0 && (
          <section className="panel">
            <h3 className="section-title">CTAs</h3>
            <ul className="tips-list">{ctas.map((c) => <li key={c}>{c}</li>)}</ul>
          </section>
        )}

        {!loading && marketingTips.length > 0 && (
          <section className="panel">
            <h3 className="section-title">Marketing tips</h3>
            <ul className="tips-list">{marketingTips.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        )}

        {source === 'api' && (
          <p className="dashboard-link">
            <Link to="/dashboard">View this prediction in the analytics dashboard →</Link>
          </p>
        )}

        <div className="page-footer-actions">
          <button type="button" onClick={() => { clearEditorHandoff(); navigate('/'); }}>
            Start over
          </button>
        </div>
      </main>
    </>
  );
}
