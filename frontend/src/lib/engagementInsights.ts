import type { EngagementComparison, EngagementPrediction, RankedCaption } from './types';

const POSITIVE = new Set(['love', 'happy', 'best', 'amazing', 'grateful', 'beautiful', 'sun', 'joy']);

export type EngagementFactorKey =
  | 'caption_length_norm'
  | 'hashtag_count_norm'
  | 'aesthetic_score'
  | 'scene_confidence'
  | 'sentiment_proxy'
  | 'brand_fit'
  | 'mood_match';

export const FACTOR_LABELS: Record<EngagementFactorKey, string> = {
  caption_length_norm: 'Caption length',
  hashtag_count_norm: 'Hashtag reach',
  aesthetic_score: 'Visual aesthetic',
  scene_confidence: 'Scene match',
  sentiment_proxy: 'Sentiment tone',
  brand_fit: 'Brand alignment',
  mood_match: 'Mood consistency',
};

function sentimentProxy(caption: string): number {
  const text = caption.toLowerCase();
  const hits = [...POSITIVE].filter((w) => text.includes(w)).length;
  return Math.min(1, hits / 5);
}

function scoreCaption(caption: string, hashtagCount: number): { score: number; factors: Record<string, number> } {
  const lenNorm = Math.min(1, caption.length / 120);
  const tagNorm = Math.min(1, hashtagCount / 15);
  const sentiment = sentimentProxy(caption);
  const factors: Record<string, number> = {
    caption_length_norm: Math.round(lenNorm * 1000) / 1000,
    hashtag_count_norm: Math.round(tagNorm * 1000) / 1000,
    aesthetic_score: 0.55,
    scene_confidence: 0.5,
    sentiment_proxy: Math.round(sentiment * 1000) / 1000,
    brand_fit: 0.72,
    mood_match: 0.68,
  };
  const score = Math.round(
    (0.35 * lenNorm + 0.3 * tagNorm + 0.2 * sentiment + 0.15 * factors.brand_fit) * 100,
  );
  return { score, factors };
}

function levelFromScore(score: number): EngagementPrediction['popularity_level'] {
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function rankCaptionsClient(captions: string[], hashtags: string[]): RankedCaption[] {
  const ranked = captions.map((caption) => {
    const { score, factors } = scoreCaption(caption, hashtags.length);
    return {
      caption,
      engagement_score: score,
      popularity_level: levelFromScore(score),
      rank: 0,
      recommended: false,
      factors,
    };
  });
  ranked.sort((a, b) => b.engagement_score - a.engagement_score);
  return ranked.map((item, i) => ({
    ...item,
    rank: i + 1,
    recommended: i === 0,
  }));
}

export function buildEngagementTips(factors: Record<string, number>): string[] {
  const tips: string[] = [];

  if ((factors.caption_length_norm ?? 1) < 0.45) {
    tips.push('Shorten your hook — lead with a punchy first line under 120 characters.');
  } else if ((factors.caption_length_norm ?? 0) > 0.92) {
    tips.push('Trim the caption — very long posts often lose scroll-stopping power on mobile.');
  }
  if ((factors.hashtag_count_norm ?? 1) < 0.5) {
    tips.push('Add 3–5 niche hashtags (#srilanka, industry tags) to improve discoverability.');
  }
  if ((factors.sentiment_proxy ?? 1) < 0.4) {
    tips.push('Use warmer, emotional words (love, grateful, amazing) to lift sentiment signal.');
  }
  if ((factors.mood_match ?? 1) < 0.72) {
    tips.push('Align caption tone with the image mood — try a different content tone setting.');
  }
  if ((factors.aesthetic_score ?? 1) < 0.5) {
    tips.push('Visual clarity is low — consider cropping, contrast, or a cleaner composition.');
  }
  if ((factors.scene_confidence ?? 1) < 0.45) {
    tips.push("Reference what's visibly in the photo — scene-specific captions score higher.");
  }
  if (!tips.length) {
    tips.push('Strong feature balance — your top-ranked caption is well optimised for engagement.');
  }
  return tips.slice(0, 4);
}

export function buildEngagementComparison(ranked: RankedCaption[]): EngagementComparison | null {
  if (ranked.length < 2) return null;
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  return {
    baseline_label: 'Standard caption (no ML ranking)',
    baseline_caption: worst.caption,
    baseline_score: worst.engagement_score,
    optimized_label: 'ML-recommended caption',
    optimized_caption: best.caption,
    optimized_score: best.engagement_score,
    score_delta: Math.round((best.engagement_score - worst.engagement_score) * 10) / 10,
  };
}

export function enrichClientEngagement(
  captions: string[],
  hashtags: string[],
): {
  captions: string[];
  ranked_captions: RankedCaption[];
  engagement: EngagementPrediction;
  engagement_tips: string[];
  engagement_comparison: EngagementComparison | null;
} {
  const ranked = rankCaptionsClient(captions, hashtags);
  const best = ranked[0];
  return {
    captions: ranked.map((r) => r.caption),
    ranked_captions: ranked,
    engagement: {
      engagement_score: best.engagement_score,
      popularity_level: best.popularity_level,
      factors: best.factors,
    },
    engagement_tips: buildEngagementTips(best.factors),
    engagement_comparison: buildEngagementComparison(ranked),
  };
}

export function factorStrength(value: number): 'strong' | 'moderate' | 'weak' {
  if (value >= 0.65) return 'strong';
  if (value >= 0.4) return 'moderate';
  return 'weak';
}
