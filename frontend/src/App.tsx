import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Editor from './pages/Editor';
import CaptionsPlaceholder from './pages/CaptionsPlaceholder';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/captions" element={<CaptionsPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}