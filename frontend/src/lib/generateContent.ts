import { captionMoodById } from './captionMoods';
import { brandById } from './brandProfiles';
import type { ContentPath } from './contentPath';
import { generateContentViaApi, isApiConfigured } from './contentApi';
import type { GeneratedContent } from './types';
import { campaignGoalById } from './marketingGoals';
import { generateContentClient } from './gemini';

export async function generateSocialContent(
  imageUri: string,
  filterName: string,
  moodId: string,
  brandId: string,
  contentPath: ContentPath = 'marketing',
  campaignGoalId?: string,
): Promise<GeneratedContent> {
  if (isApiConfigured()) {
    try {
      const result = await generateContentViaApi(
        imageUri,
        filterName,
        moodId,
        brandId,
        contentPath,
        campaignGoalId,
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
    filterLabel: filterName,
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
}
