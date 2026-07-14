import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useState } from 'react';
import type { PixelCrop } from 'react-image-crop';
import { aspectById, ASPECT_OPTIONS } from '../lib/aspectOptions';
import { saveEditorHandoff } from '../lib/editorSession';
import { AppNav } from '../components/AppNav';
import { DragCropFrame, renderPixelCrop } from '../components/DragCropFrame';
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
  const [settingsOpen, setSettingsOpen] = useState(true);
  const moods = contentPath === 'marketing' ? MARKETING_MOODS : LIFESTYLE_MOODS;

  const [aspectId, setAspectId] = useState(ASPECT_OPTIONS[1].id);
  const aspect = aspectById(aspectId);

  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPixelCropChange = useCallback((crop: PixelCrop | null, image: HTMLImageElement | null) => {
    setPixelCrop(crop);
    setCropImage(image);
  }, []);

  const onPredict = useCallback(async () => {
    if (!imageUrl) return;
    if (!pixelCrop || !cropImage || pixelCrop.width < 2 || pixelCrop.height < 2) {
      setError('Adjust the crop frame on the image first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = await renderPixelCrop(cropImage, pixelCrop, aspect.w, aspect.h, 1080);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export crop');
    } finally {
      setBusy(false);
    }
  }, [
    imageUrl,
    pixelCrop,
    cropImage,
    aspect,
    moodId,
    brandId,
    contentPath,
    campaignGoalId,
    followerCount,
    navigate,
  ]);

  if (!imageUrl) {
    return (
      <>
        <AppNav />
        <main className="page">
          <div className="empty-state">
            <p>No image selected.</p>
            <button type="button" className="primary" onClick={() => navigate('/')}>
              Back home
            </button>
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
          <button type="button" className="ghost" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div className="page-header__titles">
            <h2>Edit post</h2>
            <p className="page-header__sub muted">Drag to crop · then predict engagement</p>
          </div>
        </header>

        <div className="editor-layout">
          <div className="editor-layout__preview">
            <div className="editor__frame editor__frame--crop">
              <DragCropFrame
                imageUrl={imageUrl}
                aspectW={aspect.w}
                aspectH={aspect.h}
                onPixelCropChange={onPixelCropChange}
              />
            </div>
            <p className="editor__preview-meta muted">
              {aspect.label} · {aspect.w}:{aspect.h}
            </p>
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
                    onClick={() => setAspectId(a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <p className="muted panel__hint">
                Changing format resets the crop box. Drag the frame on the image to reframe — the photo
                never stretches.
              </p>
            </section>

            <section className="panel panel--collapsible">
              <button
                type="button"
                className="panel__toggle"
                onClick={() => setSettingsOpen((o) => !o)}
                aria-expanded={settingsOpen}
              >
                <h3 className="section-title">Analysis settings</h3>
                <span className="panel__chevron">{settingsOpen ? '▾' : '▸'}</span>
              </button>

              {settingsOpen && (
                <div className="panel__body">
                  <div className="panel__block">
                    <h4 className="section-title section-title--sm">Mode</h4>
                    <div className="chip-row">
                      <button
                        type="button"
                        className={contentPath === 'marketing' ? 'chip chip--active' : 'chip'}
                        onClick={() => {
                          setContentPath('marketing');
                          setMoodId('professional');
                        }}
                      >
                        Full marketing
                      </button>
                      <button
                        type="button"
                        className={contentPath === 'casual' ? 'chip chip--active' : 'chip'}
                        onClick={() => {
                          setContentPath('casual');
                          setMoodId('chill');
                        }}
                      >
                        Personal
                      </button>
                    </div>
                  </div>

                  <div className="panel__block">
                    <h4 className="section-title section-title--sm">Caption tone</h4>
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
                  </div>

                  {contentPath === 'marketing' && (
                    <>
                      <div className="panel__block">
                        <h4 className="section-title section-title--sm">Brand voice</h4>
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
                      </div>

                      <div className="panel__block">
                        <h4 className="section-title section-title--sm">Campaign goal</h4>
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
                      </div>
                    </>
                  )}

                  <div className="panel__block">
                    <h4 className="section-title section-title--sm">Account size</h4>
                    <p className="muted panel__hint">
                      Follower count calibrates likes prediction to your audience.
                    </p>
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
                  </div>
                </div>
              )}
            </section>

            {error && <p className="form-error">{error}</p>}

            <div className="editor__actions">
              <button type="button" className="primary btn-lg" onClick={onPredict} disabled={busy}>
                {busy ? 'Preparing…' : 'Predict engagement →'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
