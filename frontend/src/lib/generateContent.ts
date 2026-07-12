import { captionMoodById } from './captionMoods';
import { brandById } from './brandProfiles';
import { campaignGoalById } from './marketingGoals';
import type { ContentPath } from './contentPath';
import type { GeneratedContent } from './types';
import { generateContentClient } from './gemini';

export async function generateSocialContent(
  imageUri: string,
  filterName: string,
  moodId: string,
  brandId: string,
  contentPath: ContentPath = 'marketing',
  campaignGoalId?: string,
): Promise<GeneratedContent> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const mood = captionMoodById(moodId);
  const brand = brandById(brandId);
  const goal = campaignGoalById(campaignGoalId);

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