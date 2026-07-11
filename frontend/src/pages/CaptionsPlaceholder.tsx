import { useNavigate } from 'react-router-dom';
import { loadEditorHandoff, clearEditorHandoff } from '../lib/editorSession';

export default function CaptionsPlaceholder() {
  const navigate = useNavigate();
  const handoff = loadEditorHandoff();

  if (!handoff) {
    return (
      <main className="page">
        <p>No edited image. Start from home.</p>
        <button type="button" onClick={() => navigate('/')}>Home</button>
      </main>
    );
  }

  return (
    <main className="page">
      <h2>Captions — Phase 3</h2>
      <p>Filter: {handoff.filterName} · {handoff.aspectLabel}</p>
      <img src={handoff.imageBlobUrl} alt="Edited" style={{ maxWidth: 320, borderRadius: 8 }} />
      <p>Caption generation will be added in Phase 3.</p>
      <button type="button" onClick={() => { clearEditorHandoff(); navigate('/'); }}>
        Start over
      </button>
    </main>
  );
}