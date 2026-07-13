export const APP_NAME = 'SocialEngage AI';
export const APP_TAGLINE = 'Instagram engagement prediction powered by multimodal ML';

export const MODEL_STATS = {
  r2: '0.60',
  mae: '4.46',
  dataset: '9,883',
  model: 'Gradient Boosting · Kim WWW\'20',
} as const;

export const PIPELINE_MODULES = [
  {
    id: 'analytics',
    title: 'Engagement Predictor',
    tech: 'Gradient Boosting · Kim WWW\'20',
    desc: 'Predicts likes, engagement score 0–100, and popularity level (low/medium/high)',
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
