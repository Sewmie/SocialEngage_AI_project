import { useEffect, useState } from 'react';

export default function Home() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then((d) => setHealth(JSON.stringify(d)))
      .catch(() => setHealth('backend offline'));
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: 'system-ui' }}>
      <h1>SocialEngage AI</h1>
      <p>Phase 1 — React web + FastAPI foundation</p>
      <pre>{health}</pre>
    </main>
  );
}