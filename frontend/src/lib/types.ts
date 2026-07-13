import type { ContentPath } from './contentPath';

export type VisualAnalysis = {
  scene_labels: string[];
  dominant_mood: string;
  aesthetic_score: number;
  objects_detected: string[];
};

export type EngagementPrediction = {
  engagement_score: number;
  popularity_level: 'low' | 'medium' | 'high';
  factors: Record<string, number>;
};

export type RankedCaption = {
  caption: string;
  engagement_score: number;
  popularity_level: 'low' | 'medium' | 'high';
  rank: number;
  recommended: boolean;
  factors: Record<string, number>;
};

export type EngagementComparison = {
  baseline_label: string;
  baseline_caption: string;
  baseline_score: number;
  optimized_label: string;
  optimized_caption: string;
  optimized_score: number;
  score_delta: number;
};

export type MarketingExtras = {
  hooks: string[];
  ctas: string[];
  marketing_tips: string[];
};

export type GeneratedContent = {
  captions: string[];
  ranked_captions?: RankedCaption[];
  hashtags: string[];
  visual_analysis?: VisualAnalysis;
  engagement?: EngagementPrediction;
  engagement_tips?: string[];
  engagement_comparison?: EngagementComparison | null;
  marketing?: MarketingExtras;
  content_path?: ContentPath;
  source: 'api' | 'client';
};

export type CaptionVsBest = {
  best_caption: string;
  best_score: number;
  score_delta: number;
};

export type CaptionScoreResult = {
  caption: string;
  hashtags_detected: string[];
  visual_analysis: VisualAnalysis;
  engagement: EngagementPrediction;
  engagement_tips: string[];
  vs_best?: CaptionVsBest | null;
};
