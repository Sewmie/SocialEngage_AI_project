export type CaptionMood = {
  id: string;
  /** Short UI label */
  label: string;
  /** Steers the model’s tone for all 10 lines */
  tone: string;
};

/**
 * Content tone options — steers caption generation and engagement feature scoring.
 * Lifestyle tones for personal posts; marketing tones for SME / campaign analysis.
 */
export const CAPTION_MOODS: CaptionMood[] = [
  // Lifestyle & personal
  { id: 'chill', label: 'Chill', tone: 'relaxed, unbothered, soft flex, nothing-is-that-deep energy' },
  { id: 'cozy', label: 'Cozy', tone: 'warm, homey, soft vibes, comfort-first, gentle and intimate' },
  { id: 'romantic', label: 'Romantic', tone: 'tender, dreamy, a little poetic, date-night or crush-coded' },
  { id: 'bold', label: 'Bold', tone: 'confident, loud, main-character energy, unapologetic' },
  { id: 'funny', label: 'Funny', tone: 'playful, witty, self-aware jokes, light chaos, not mean-spirited' },
  { id: 'nostalgic', label: 'Nostalgic', tone: 'wistful, memory-lane, film-grain feelings, soft longing' },
  { id: 'travel', label: 'Wander', tone: 'adventure, planes/trains/roads, discovery, “gone again” energy' },
  { id: 'nightout', label: 'Night out', tone: 'party, city lights, getting ready, hype but still authentic' },
  { id: 'aesthetic', label: 'Aesthetic', tone: 'curated feed, art-school calm, moodboard captions, minimal flex' },
  { id: 'real', label: 'Real talk', tone: 'honest, grounded, slightly vulnerable, conversational truth' },

  // Marketing & engagement (SME / campaign)
  {
    id: 'professional',
    label: 'Professional',
    tone: 'polished, credible, brand-safe, clear value — suited to business and corporate posts',
  },
  {
    id: 'promotional',
    label: 'Promotional',
    tone: 'urgency, limited-time offers, discounts, conversion-focused without being spammy',
  },
  {
    id: 'educational',
    label: 'Educational',
    tone: 'helpful tips, how-to, expertise-led, saves-and-shares friendly, authority building',
  },
  {
    id: 'inspirational',
    label: 'Inspirational',
    tone: 'motivating, uplifting, gratitude and growth, aspirational but authentic',
  },
  {
    id: 'community',
    label: 'Community',
    tone: 'local pride, togetherness, support-local warmth — #srilanka #lka friendly',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    tone: 'premium, refined, understated exclusivity, less words more impact',
  },
  {
    id: 'festive',
    label: 'Festive',
    tone: 'celebration, events, holidays, joyful occasion energy, share-the-moment',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    tone: 'short, clean, whitespace energy, one-liner impact, no fluff',
  },
  {
    id: 'storytelling',
    label: 'Storytelling',
    tone: 'narrative hook, behind-the-scenes arc, emotional journey, brand story led',
  },
  {
    id: 'trust',
    label: 'Trust-building',
    tone: 'social proof, testimonials vibe, transparent, reassuring, customer-first',
  },
];

export const LIFESTYLE_MOODS = CAPTION_MOODS.filter((m) =>
  [
    'chill',
    'cozy',
    'romantic',
    'bold',
    'funny',
    'nostalgic',
    'travel',
    'nightout',
    'aesthetic',
    'real',
  ].includes(m.id),
);

export const MARKETING_MOODS = CAPTION_MOODS.filter((m) =>
  [
    'professional',
    'promotional',
    'educational',
    'inspirational',
    'community',
    'luxury',
    'festive',
    'minimal',
    'storytelling',
    'trust',
  ].includes(m.id),
);

export function captionMoodById(id: string | undefined): CaptionMood {
  if (!id) return CAPTION_MOODS[0];
  return CAPTION_MOODS.find((m) => m.id === id) ?? CAPTION_MOODS[0];
}
