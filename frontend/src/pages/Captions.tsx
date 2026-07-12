import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadEditorHandoff, clearEditorHandoff } from '../lib/editorSession';
import { generateSocialContent } from '../lib/generateContent';
import { formatGeminiError } from '../lib/geminiModels';
import { captionMoodById } from '../lib/captionMoods';
import { brandById } from '../lib/brandProfiles';
import type { EngagementComparison, RankedCaption, VisualAnalysis } from '../lib/types';

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
      <main className="page">
        <p>{error}</p>
        <button type="button" onClick={() => navigate('/')}>Home</button>
      </main>
    );
  }

  const mood = captionMoodById(handoff?.moodId);
  const brand = brandById(handoff?.brandId);
  const scoreLabel = source === 'api' ? 'ML engagement score' : 'Engagement score (heuristic)';

  return (
    <main className="page">
      <header className="editor__header">
        <button type="button" onClick={() => navigate('/editor')}>← Back</button>
        <h2>Generated content</h2>
      </header>

      {handoff && (
        <img src={handoff.imageBlobUrl} alt="Post" style={{ maxWidth: 200, borderRadius: 8 }} />
      )}

      <p className="muted">
        {mood.label} · {brand.label} · {handoff?.contentPath === 'marketing' ? 'Marketing' : 'Casual'}
        {source && (
          <> · <span className={`source-badge source-badge--${source}`}>
            {source === 'api' ? 'Multimodal API (CLIP + Gemini + ML)' : 'Client fallback (Gemini)'}
          </span></>
        )}
      </p>

      {loading && (
        <p>
          Running multimodal pipeline… CLIP analysis + Gemini captions + ML ranking (30–90s on first run)
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {!loading && visual && (
        <section className="visual-card">
          <h3>CLIP visual analysis</h3>
          <p><strong>Scenes:</strong> {visual.scene_labels.join(', ') || '—'}</p>
          <p><strong>Mood:</strong> {visual.dominant_mood}</p>
          <p><strong>Objects:</strong> {visual.objects_detected.join(', ') || '—'}</p>
          <p><strong>Aesthetic score:</strong> {Math.round(visual.aesthetic_score * 100)}%</p>
        </section>
      )}

      {!loading && !error && score !== null && (
        <div className="score-box">
          <strong>{scoreLabel}:</strong> {Math.round(score)}/100
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
          <h3>Ranked captions</h3>
          {ranked.map((item) => (
            <div key={item.rank} className={`caption-card ${item.recommended ? 'caption-card--best' : ''}`}>
              <div className="caption-card__meta">
                #{item.rank} · {Math.round(item.engagement_score)}/100 · {item.popularity_level}
                {item.recommended && ' · Recommended'}
              </div>
              <p>{item.caption}</p>
              <button type="button" onClick={() => copy(item.caption)}>Copy</button>
            </div>
          ))}
        </section>
      )}

      {!loading && hashtags.length > 0 && (
        <section>
          <h3>Hashtags</h3>
          <p>{hashtags.join(' ')}</p>
          <button type="button" onClick={() => copy(hashtags.join(' '))}>Copy all</button>
        </section>
      )}

      {!loading && tips.length > 0 && (
        <section>
          <h3>Tips</h3>
          <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}

      {!loading && hooks.length > 0 && (
        <section>
          <h3>Hooks</h3>
          <ul>{hooks.map((h) => <li key={h}>{h}</li>)}</ul>
        </section>
      )}

      {!loading && ctas.length > 0 && (
        <section>
          <h3>CTAs</h3>
          <ul>{ctas.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
      )}

      {!loading && marketingTips.length > 0 && (
        <section>
          <h3>Marketing tips</h3>
          <ul>{marketingTips.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}

      <button type="button" onClick={() => { clearEditorHandoff(); navigate('/'); }}>
        Start over
      </button>
    </main>
  );
}
