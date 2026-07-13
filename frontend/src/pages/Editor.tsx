import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aspectById, ASPECT_OPTIONS } from '../lib/aspectOptions';
import { renderEditedImage, type CropState } from '../lib/imageCanvas';
import { saveEditorHandoff } from '../lib/editorSession';
import { AppNav } from '../components/AppNav';
import { MARKETING_MOODS, LIFESTYLE_MOODS } from '../lib/captionMoods';
import { BRAND_PROFILES } from '../lib/brandProfiles';
import { CAMPAIGN_GOALS } from '../lib/marketingGoals';
import type { ContentPath } from '../lib/contentPath';


type LocationState = { imageUrl?: string; fileName?: string };

export default function Editor() {
  const { state } = useLocation() as { state: LocationState };
  const navigate = useNavigate();
  const imageUrl = state?.imageUrl;
  const [contentPath, setContentPath] = useState<ContentPath>('marketing');
  const [moodId, setMoodId] = useState('professional');
  const [brandId, setBrandId] = useState('local_sme');
  const [campaignGoalId, setCampaignGoalId] = useState('awareness');
  const [followerCount, setFollowerCount] = useState('2500');
  const moods = contentPath === 'marketing' ? MARKETING_MOODS : LIFESTYLE_MOODS;

  const [aspectId, setAspectId] = useState(ASPECT_OPTIONS[1].id);
  const [crop, setCrop] = useState<CropState>({ panX: 0, panY: 0, zoom: 1 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const aspect = useMemo(() => aspectById(aspectId), [aspectId]);

  // Debounced preview render
  useEffect(() => {
    if (!imageUrl) return;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const url = await renderEditedImage(imageUrl, aspect.w, aspect.h, crop, 720);
        setPreviewUrl((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return url;
        });
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [imageUrl, aspect, crop]);

  const onContinue = useCallback(async () => {
    if (!imageUrl) return;
    const url = await renderEditedImage(imageUrl, aspect.w, aspect.h, crop, 1080);
    saveEditorHandoff({
      imageBlobUrl: url,
      aspectLabel: aspect.label,
      moodId,
      brandId,
      contentPath,
      campaignGoalId: contentPath === 'marketing' ? campaignGoalId : undefined,
      followerCount: Math.max(0, parseInt(followerCount, 10) || 0),
    });
    navigate('/captions');
  }, [imageUrl, aspect, crop, navigate, moodId, brandId, contentPath, campaignGoalId, followerCount]);

  if (!imageUrl) {
    return (
      <>
        <AppNav />
        <main className="page">
          <div className="empty-state">
            <p>No image selected.</p>
            <button type="button" className="primary" onClick={() => navigate('/')}>Back home</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="page editor">
        <header className="page-header">
          <button type="button" className="ghost" onClick={() => navigate('/')}>← Back</button>
          <h2>Edit post</h2>
        </header>

        <div className="editor-layout">
          <div className="editor-layout__preview">
            <div
              className="editor__preview"
              style={{ aspectRatio: `${aspect.w} / ${aspect.h}` }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" />
              ) : (
                <div className="editor__loading">{busy ? 'Updating…' : 'Loading…'}</div>
              )}
            </div>
          </div>

          <div className="editor-layout__controls">
            <section className="panel">
              <h3 className="section-title">Format</h3>
              <div className="chip-row">
                {ASPECT_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={a.id === aspectId ? 'chip chip--active' : 'chip'}
                    onClick={() => { setAspectId(a.id); setCrop({ panX: 0, panY: 0, zoom: 1 }); }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 className="section-title">Position</h3>
              <div className="slider-group">
                <label className="slider-label">
                  Zoom
                  <input type="range" min={1} max={3} step={0.01} value={crop.zoom}
                    onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))} />
                  <span>{crop.zoom.toFixed(2)}</span>
                </label>
                <label className="slider-label">
                  Pan X
                  <input type="range" min={-1} max={1} step={0.01} value={crop.panX}
                    onChange={(e) => setCrop((c) => ({ ...c, panX: Number(e.target.value) }))} />
                  <span>{crop.panX.toFixed(2)}</span>
                </label>
                <label className="slider-label">
                  Pan Y
                  <input type="range" min={-1} max={1} step={0.01} value={crop.panY}
                    onChange={(e) => setCrop((c) => ({ ...c, panY: Number(e.target.value) }))} />
                  <span>{crop.panY.toFixed(2)}</span>
                </label>
              </div>
            </section>

            <section className="panel">
              <h3 className="section-title">Analysis mode</h3>
              <div className="chip-row">
                <button
                  type="button"
                  className={contentPath === 'marketing' ? 'chip chip--active' : 'chip'}
                  onClick={() => {
                    setContentPath('marketing');
                    setMoodId('professional');
                  }}
                >
                  Full marketing analysis
                </button>
                <button
                  type="button"
                  className={contentPath === 'casual' ? 'chip chip--active' : 'chip'}
                  onClick={() => {
                    setContentPath('casual');
                    setMoodId('chill');
                  }}
                >
                  Quick personal post
                </button>
              </div>
            </section>

            <section className="panel">
              <h3 className="section-title">Caption tone</h3>
              <div className="chip-row">
                {moods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={m.id === moodId ? 'chip chip--active' : 'chip'}
                    onClick={() => setMoodId(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </section>

            {contentPath === 'marketing' && (
              <>
                <section className="panel">
                  <h3 className="section-title">Brand voice</h3>
                  <div className="chip-row">
                    {BRAND_PROFILES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={b.id === brandId ? 'chip chip--active' : 'chip'}
                        onClick={() => setBrandId(b.id)}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <h3 className="section-title">Campaign goal</h3>
                  <div className="chip-row">
                    {CAMPAIGN_GOALS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={g.id === campaignGoalId ? 'chip chip--active' : 'chip'}
                        onClick={() => setCampaignGoalId(g.id)}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            <section className="panel">
              <h3 className="section-title">Account size</h3>
              <p className="muted panel__hint">Follower count calibrates the engagement score to your audience.</p>
              <label className="slider-label">
                Followers
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={followerCount}
                  onChange={(e) => setFollowerCount(e.target.value)}
                  className="text-input"
                />
              </label>
            </section>

            <div className="editor__actions">
              <button type="button" className="primary" onClick={onContinue} disabled={busy}>
                Continue to captions →
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}