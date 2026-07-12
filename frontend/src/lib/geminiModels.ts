/** Gemini models to try, newest first (June 2026 — 1.5/2.0 Flash are shut down). */
export const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ] as const;
  
  export type GeminiModelId = (typeof GEMINI_MODELS)[number];
  
  /** Turn raw SDK / API errors into short user-facing messages. */
  export function formatGeminiError(raw: string): string {
    const msg = raw.trim();
  
    if (!msg) {
      return 'Caption generation failed. Please try again.';
    }
  
    if (/API key|API_KEY|403|401|permission/i.test(msg)) {
      return 'Invalid or missing Gemini API key. Add VITE_GEMINI_API_KEY to frontend/.env and restart.';
    }
  
    if (/404|not found|is not supported/i.test(msg)) {
      return 'The AI model is no longer available. Pull the latest app code — model names were updated.';
    }
  
    if (/429|quota|rate limit/i.test(msg)) {
      return 'Gemini rate limit reached. Wait a minute and try again.';
    }
  
    if (/timed out/i.test(msg)) {
      return msg;
    }
  
    if (msg.includes('[GoogleGenerativeAI Error]') || msg.length > 180) {
      return 'Could not generate captions. Check your internet connection and Gemini API key, then try again.';
    }
  
    return msg;
  }
  