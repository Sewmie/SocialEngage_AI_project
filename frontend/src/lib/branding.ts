export const APP_NAME = 'SocialEngage AI';
export const APP_TAGLINE = 'Instagram engagement prediction powered by multimodal ML';

export const MODEL_STATS = {
  r2: '0.08',
  mae: '7.75',
  dataset: '9,883',
  model: 'CLIP + Gradient Boosting',
} as const;

export const PIPELINE_MODULES = [
  {
    id: 'analytics',
    title: 'Engagement Predictor',
    tech: 'Gradient Boosting · CLIP features',
    desc: 'Scores each caption 0–100, ranks recommendations, explains factors',
  },
  {
    id: 'vision',
    title: 'Visual Understanding',
    tech: 'CLIP ViT-B/32',
    desc: 'Scene, mood, aesthetic & object features for the ML model',
  },
  {
    id: 'nlp',
    title: 'Caption Generation',
    tech: 'Gemini · side module',
    desc: 'Context-aware copy & hashtags to score against the predictor',
  },
  {
    id: 'brand',
    title: 'Brand Conditioning',
    tech: 'Prompt profiles',
    desc: 'SME, corporate & creator voices shape analysis context',
  },
] as const;
