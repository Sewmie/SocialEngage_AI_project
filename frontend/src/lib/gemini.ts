import { resizeForModel } from './resizeImage';

import { GoogleGenerativeAI } from '@google/generative-ai';

import { captionMoodById } from './captionMoods';
import { enrichClientEngagement } from './engagementInsights';
import { GEMINI_MODELS, formatGeminiError } from './geminiModels';
import { readImageAsBase64 } from './readImageAsBase64';

/** Smaller image = faster read + smaller API payload; captions still match the scene. */
const GENERATE_TIMEOUT_MS = 75_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      reject(
        new Error(
          `Caption request timed out after ${Math.round(ms / 1000)}s. Check your network or try again.`,
        ),
      );
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

async function makeModelSizedCopy(uri: string): Promise<string> {
  try {
    return await resizeForModel(uri);
  } catch {
    return uri;
  }
}

const MARKETING_PROMPT = `You are an expert social media marketing strategist for Instagram.

Filter: "{{FILTER}}" · Tone: "{{MOOD_LABEL}}" ({{MOOD_TONE}})
Brand: {{BRAND_LABEL}} — {{BRAND_VOICE}}
Campaign goal: {{CAMPAIGN_GOAL}} — {{CAMPAIGN_PROMPT}}

Look at this image. Generate professional MARKETING content optimized for engagement and conversions.

Return ONLY valid JSON:
{
  "captions": ["...", ... exactly 10 strategic marketing captions],
  "hashtags": ["#tag1", ... 12 to 15 optimized tags],
  "hooks": ["...", ... 5 scroll-stopping opening lines],
  "ctas": ["...", ... 5 call-to-action lines],
  "marketing_tips": ["...", ... 3 short performance tips]
}

Rules:
- Captions: value-driven, brand-aligned, subtle persuasion; under 220 chars each
- Hooks: punchy scroll-stoppers for Reels/carousels
- CTAs: shop, DM, save, share, visit — action-oriented
- Hashtags: branded + niche + local (#srilanka #lka when relevant)
- No markdown outside JSON`;

const CASUAL_PROMPT = `You write casual Instagram captions for personal everyday posts (NOT corporate marketing).

Filter: "{{FILTER}}" · Mood: "{{MOOD_LABEL}}" ({{MOOD_TONE}})

Look at this image. Return ONLY valid JSON:
{
  "captions": ["...", ... exactly 10 casual personal captions],
  "hashtags": ["#tag1", ... 5 to 8 light tags]
}

Rules:
- Personal, authentic, Gen-Z friendly; reference what's visible
- No sales pitch, no corporate speak, no forced CTAs
- Under 180 chars each; varied phrasing
- No markdown outside JSON`;

function stripCodeFence(text: string): string {
  const t = text.trim();
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t;
}

function parseContentJson(
  raw: string,
  contentPath: 'marketing' | 'casual',
): {
  captions: string[];
  hashtags: string[];
  hooks: string[];
  ctas: string[];
  marketing_tips: string[];
} {
  const empty = { captions: [] as string[], hashtags: [] as string[], hooks: [] as string[], ctas: [] as string[], marketing_tips: [] as string[] };
  const cleaned = stripCodeFence(raw);
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const captions = Array.isArray(obj.captions)
        ? obj.captions
            .filter((x): x is string => typeof x === 'string')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 10)
        : [];
      const maxTags = contentPath === 'marketing' ? 15 : 8;
      const hashtags = Array.isArray(obj.hashtags)
        ? obj.hashtags
            .filter((x): x is string => typeof x === 'string')
            .map((s) => (s.startsWith('#') ? s : `#${s}`).trim())
            .filter(Boolean)
            .slice(0, maxTags)
        : [];
      const hooks =
        contentPath === 'marketing' && Array.isArray(obj.hooks)
          ? obj.hooks.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 5)
          : [];
      const ctas =
        contentPath === 'marketing' && Array.isArray(obj.ctas)
          ? obj.ctas.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 5)
          : [];
      const marketing_tips =
        contentPath === 'marketing' && Array.isArray(obj.marketing_tips)
          ? obj.marketing_tips.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 4)
          : [];
      if (captions.length) return { captions, hashtags, hooks, ctas, marketing_tips };
    }
    if (Array.isArray(parsed)) {
      return {
        captions: parsed
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10),
        hashtags: [],
        hooks: [],
        ctas: [],
        marketing_tips: [],
      };
    }
  } catch {
    // fall through
  }
  const lines = cleaned
    .split(/\n/)
    .map((l) => l.replace(/^\s*\d+[\).\s]+/, '').replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  return { ...empty, captions: lines.slice(0, 10) };
}

export type GenerateContentClientOptions = {
  imageUri: string;
  filterLabel: string;
  moodLabel: string;
  moodTone: string;
  brandLabel: string;
  brandVoice: string;
  apiKey: string | undefined;
  contentPath: 'marketing' | 'casual';
  campaignGoalLabel?: string;
  campaignGoalPrompt?: string;
};

export async function generateContentClient(
  opts: GenerateContentClientOptions,
): Promise<Omit<import('./types').GeneratedContent, 'source'>> {
  const {
    imageUri,
    filterLabel,
    moodLabel,
    moodTone,
    brandLabel,
    brandVoice,
    apiKey,
    contentPath,
    campaignGoalLabel = 'Brand awareness',
    campaignGoalPrompt = 'build recognition',
  } = opts;

  if (!apiKey?.trim()) {
    throw new Error('Captions are not configured for this build.');
  }

  let modelUri = imageUri;
  try {
    modelUri = await makeModelSizedCopy(imageUri);
  } catch {
    modelUri = imageUri;
  }

  const base64 = await readImageAsBase64(modelUri);
  const mimeType = 'image/jpeg';

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const template = contentPath === 'marketing' ? MARKETING_PROMPT : CASUAL_PROMPT;
  const prompt = template
    .replace('{{FILTER}}', filterLabel)
    .replace('{{MOOD_LABEL}}', moodLabel)
    .replace('{{MOOD_TONE}}', moodTone)
    .replace('{{BRAND_LABEL}}', brandLabel)
    .replace('{{BRAND_VOICE}}', brandVoice)
    .replace('{{CAMPAIGN_GOAL}}', campaignGoalLabel)
    .replace('{{CAMPAIGN_PROMPT}}', campaignGoalPrompt);

  const modelsToTry = GEMINI_MODELS;

  let lastErr: unknown;
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await withTimeout(
        model.generateContent([
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ]),
        GENERATE_TIMEOUT_MS,
      );
      const text = result.response.text();
      const parsed = parseContentJson(text, contentPath);
      if (parsed.captions.length > 0) {
        const enriched = enrichClientEngagement(parsed.captions, parsed.hashtags);
        return {
          captions: enriched.captions,
          ranked_captions: enriched.ranked_captions,
          hashtags: parsed.hashtags,
          engagement: enriched.engagement,
          engagement_tips: enriched.engagement_tips,
          engagement_comparison: enriched.engagement_comparison,
          marketing:
            contentPath === 'marketing'
              ? {
                  hooks: parsed.hooks,
                  ctas: parsed.ctas,
                  marketing_tips: parsed.marketing_tips,
                }
              : undefined,
        };
      }
      lastErr = new Error('Empty caption response; try again.');
    } catch (e) {
      lastErr = e;
    }
  }

  const raw = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(formatGeminiError(raw));
}

/** @deprecated Use generateContentClient or generateSocialContent */
export async function generateTenCaptions(
  imageUri: string,
  filterLabel: string,
  apiKey: string | undefined,
  moodId?: string,
): Promise<string[]> {
  const mood = captionMoodById(moodId);
  const out = await generateContentClient({
    imageUri,
    filterLabel,
    moodLabel: mood.label,
    moodTone: mood.tone,
    brandLabel: 'Casual creator',
    brandVoice: 'relatable influencer tone',
    apiKey,
    contentPath: 'casual',
  });
  return out.captions;
}
