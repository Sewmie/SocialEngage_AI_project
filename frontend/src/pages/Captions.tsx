import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadEditorHandoff, clearEditorHandoff } from '../lib/editorSession';
import { generateSocialContent } from '../lib/generateContent';
import { formatGeminiError } from '../lib/geminiModels';
import { captionMoodById } from '../lib/captionMoods';
import { brandById } from '../lib/brandProfiles';
import type { EngagementComparison, RankedCaption, VisualAnalysis } from '../lib/types';
import { AppNav } from '../components/AppNav';

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
  const [tips, setTips] = useState<string[]>([]);
  const [comparison, setComparison] = useState<EngagementComparison | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [ctas, setCtas] = useState<string[]>([]);
  const [marketingTips, setMarketingTips] = useState<string[]>([]);

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
          handoff.filterName,
          handoff.moodId,
          handoff.brandId,
          handoff.contentPath,
          handoff.campaignGoalId,
        );
        if (cancelled) return;

        setSource(result.source);
        setVisual(result.visual_analysis ?? null);
        setRanked(result.ranked_captions ?? []);
        setHashtags(result.hashtags);
        setScore(result.engagement?.engagement_score ?? null);
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
  const scoreLabel = source === 'api' ? 'ML engagement score' : 'Engagement score (heuristic)';

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

        {!loading && !error && score !== null && (
          <div className="score-box">
            <div className="score-box__ring">
              <span className="score-box__value">{Math.round(score)}</span>
            </div>
            <div className="score-box__label">
              <strong>{scoreLabel}</strong>
              out of 100 — predicted engagement potential
            </div>
          </div>
        )}

        {!loading && comparison && (
          <section className="comparison-card">
            <h3>Caption optimization</h3>
            <p className="muted">{comparison.baseline_label} ({comparison.baseline_score}/100)</p>
            <p className="comparison-caption">{comparison.baseline_caption}</p>
            <p className="muted">{comparison.optimized_label} ({comparison.optimized_score}/100)</p>
            <p className="comparison-caption comparison-caption--best">{comparison.optimized_caption}</p>
            <p><strong>Score delta:</strong> +{comparison.score_delta}</p>
          </section>
        )}

        {!loading && ranked.length > 0 && (
          <section>
            <h3 className="section-title">Ranked captions</h3>
            {ranked.map((item) => (
              <div key={item.rank} className={`caption-card ${item.recommended ? 'caption-card--best' : ''}`}>
                <div className="caption-card__meta">
                  <span>#{item.rank} · {Math.round(item.engagement_score)}/100 · {item.popularity_level}</span>
                  {item.recommended && <span className="caption-card__badge">Recommended</span>}
                </div>
                <p>{item.caption}</p>
                <button type="button" className="btn-copy" onClick={() => copy(item.caption)}>Copy</button>
              </div>
            ))}
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
