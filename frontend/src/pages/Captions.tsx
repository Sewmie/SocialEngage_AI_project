import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadEditorHandoff, clearEditorHandoff } from '../lib/editorSession';
import { generateSocialContent } from '../lib/generateContent';
import { formatGeminiError } from '../lib/geminiModels';
import { captionMoodById } from '../lib/captionMoods';
import { brandById } from '../lib/brandProfiles';
import type { RankedCaption } from '../lib/types';

export default function Captions() {
  const navigate = useNavigate();
  const handoff = loadEditorHandoff();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ranked, setRanked] = useState<RankedCaption[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [tips, setTips] = useState<string[]>([]);
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

        setRanked(result.ranked_captions ?? []);
        setHashtags(result.hashtags);
        setScore(result.engagement?.engagement_score ?? null);
        setTips(result.engagement_tips ?? []);
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
      </p>

      {loading && <p>Generating captions with Gemini… (15–45s)</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && score !== null && (
        <div className="score-box">
          <strong>Engagement score (heuristic):</strong> {score}/100
        </div>
      )}

      {!loading && ranked.length > 0 && (
        <section>
          <h3>Ranked captions</h3>
          {ranked.map((item) => (
            <div key={item.rank} className={`caption-card ${item.recommended ? 'caption-card--best' : ''}`}>
              <div className="caption-card__meta">
                #{item.rank} · {item.engagement_score}/100 · {item.popularity_level}
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