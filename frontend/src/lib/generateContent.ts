import { captionMoodById } from './captionMoods';
import { brandById } from './brandProfiles';
import type { ContentPath } from './contentPath';
import { generateContentViaApi, isApiConfigured } from './contentApi';
import type { GeneratedContent } from './types';
import { campaignGoalById } from './marketingGoals';
import { generateContentClient } from './gemini';

/** Dedupe in-flight calls (React Strict Mode mounts effects twice in dev). */
const inflight = new Map<string, Promise<GeneratedContent>>();

function requestKey(
  imageUri: string,
  moodId: string,
  brandId: string,
  contentPath: ContentPath,
  campaignGoalId?: string,
  followerCount?: number,
): string {
  return [imageUri, moodId, brandId, contentPath, campaignGoalId ?? '', followerCount ?? ''].join('|');
}

export async function generateSocialContent(
  imageUri: string,
  moodId: string,
  brandId: string,
  contentPath: ContentPath = 'marketing',
  campaignGoalId?: string,
  followerCount?: number,
): Promise<GeneratedContent> {
  const key = requestKey(
    imageUri,
    moodId,
    brandId,
    contentPath,
    campaignGoalId,
    followerCount,
  );
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }

  const work = (async (): Promise<GeneratedContent> => {
    if (isApiConfigured()) {
      try {
        const result = await generateContentViaApi(
          imageUri,
          moodId,
          brandId,
          contentPath,
          campaignGoalId,
          followerCount,
        );
        return { ...result, content_path: contentPath };
      } catch {
        // fall through to client-side Gemini
      }
    }

    const mood = captionMoodById(moodId);
    const brand = brandById(brandId);
    const goal = campaignGoalById(campaignGoalId);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    const client = await generateContentClient({
      imageUri,
      moodLabel: mood.label,
      moodTone: mood.tone,
      brandLabel: brand.label,
      brandVoice: brand.voice,
      apiKey,
      contentPath,
      campaignGoalLabel: goal.label,
      campaignGoalPrompt: goal.prompt,
    });

    return { ...client, content_path: contentPath, source: 'client' };
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    if (inflight.get(key) === work) {
      inflight.delete(key);
    }
  }
}
