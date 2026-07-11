import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';

export default function Home() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File) => {
    const url = URL.createObjectURL(file);
    navigate('/editor', { state: { imageUrl: url, fileName: file.name } });
  };

  return (
    <main className="page">
      <h1>SocialEngage AI</h1>
      <p>Upload an Instagram post image to crop and style it.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      <button type="button" onClick={() => inputRef.current?.click()}>
        Choose photo
      </button>
    </main>
  );
}