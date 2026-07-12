import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aspectById, ASPECT_OPTIONS } from '../lib/aspectOptions';
import { FILTER_PRESETS, presetById } from '../lib/filterPresets';
import { renderEditedImage, downloadBlobUrl, type CropState } from '../lib/imageCanvas';
import { saveEditorHandoff } from '../lib/editorSession';
import '../styles/editor.css';
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
  const moods = contentPath === 'marketing' ? MARKETING_MOODS : LIFESTYLE_MOODS;

  const [aspectId, setAspectId] = useState(ASPECT_OPTIONS[1].id);
  const [filterId, setFilterId] = useState(FILTER_PRESETS[0].id);
  const [crop, setCrop] = useState<CropState>({ panX: 0, panY: 0, zoom: 1 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const aspect = useMemo(() => aspectById(aspectId), [aspectId]);
  const preset = useMemo(() => presetById(filterId), [filterId]);

  // Debounced preview render
  useEffect(() => {
    if (!imageUrl) return;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const url = await renderEditedImage(imageUrl, aspect.w, aspect.h, crop, preset, 720);
        setPreviewUrl((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return url;
        });
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [imageUrl, aspect, crop, preset]);

  const onDownload = useCallback(async () => {
    if (!imageUrl) return;
    const url = await renderEditedImage(imageUrl, aspect.w, aspect.h, crop, preset, 1080);
    downloadBlobUrl(url);
  }, [imageUrl, aspect, crop, preset]);

  const onContinue = useCallback(async () => {
    if (!imageUrl) return;
    const url = await renderEditedImage(imageUrl, aspect.w, aspect.h, crop, preset, 1080);
    saveEditorHandoff({
      imageBlobUrl: url,
      filterName: preset.name,
      aspectLabel: aspect.label,
      moodId,
      brandId,
      contentPath,
      campaignGoalId: contentPath === 'marketing' ? campaignGoalId : undefined,
    });
    navigate('/captions');
  }, [imageUrl, aspect, crop, preset, navigate, moodId, brandId, contentPath, campaignGoalId]);

  if (!imageUrl) {
    return (
      <main className="page">
        <p>No image selected.</p>
        <button type="button" onClick={() => navigate('/')}>Back home</button>
      </main>
    );
  }

  return (
    <main className="page editor">
      <header className="editor__header">
        <button type="button" onClick={() => navigate('/')}>← Back</button>
        <h2>Edit post</h2>
      </header>

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

      <section>
        <h3>Format</h3>
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

      <section>
        <h3>Position</h3>
        <label>Zoom<input type="range" min={1} max={3} step={0.01} value={crop.zoom}
          onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))} /></label>
        <label>Pan X<input type="range" min={-1} max={1} step={0.01} value={crop.panX}
          onChange={(e) => setCrop((c) => ({ ...c, panX: Number(e.target.value) }))} /></label>
        <label>Pan Y<input type="range" min={-1} max={1} step={0.01} value={crop.panY}
          onChange={(e) => setCrop((c) => ({ ...c, panY: Number(e.target.value) }))} /></label>
      </section>

      <section>
        <h3>Filter</h3>
        <div className="chip-row chip-row--wrap">
          {FILTER_PRESETS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={f.id === filterId ? 'chip chip--active' : 'chip'}
              onClick={() => setFilterId(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Analysis mode</h3>
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

      <section>
        <h3>Caption tone</h3>
        <div className="chip-row chip-row--wrap">
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
          <section>
            <h3>Brand voice</h3>
            <div className="chip-row chip-row--wrap">
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

          <section>
            <h3>Campaign goal</h3>
            <div className="chip-row chip-row--wrap">
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

      <div className="editor__actions">
        <button type="button" onClick={onDownload}>Download JPEG</button>
        <button type="button" className="primary" onClick={onContinue} disabled={busy}>
          Continue to captions →
        </button>
      </div>
    </main>
  );
}