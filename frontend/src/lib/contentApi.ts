import type { ContentPath } from './contentPath';
import type { CaptionScoreResult, GeneratedContent } from './types';

function apiBase(): string {
  const url = import.meta.env.VITE_API_URL?.trim();
  return url && url.length > 0 ? url.replace(/\/$/, '') : '';
}

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error('Could not read image for upload.');
  }
  return res.blob();
}

export function isApiConfigured(): boolean {
  return Boolean(apiBase());
}

export async function generateContentViaApi(
  imageUri: string,
  moodId: string,
  brandId: string,
  contentPath: ContentPath = 'marketing',
  campaignGoalId?: string,
  followerCount?: number,
): Promise<GeneratedContent> {
  const base = apiBase();
  if (!base) {
    throw new Error('VITE_API_URL is not set.');
  }

  const form = new FormData();
  const blob = await uriToBlob(imageUri);
  form.append('image', blob, 'upload.jpg');
  form.append('mood_id', moodId);
  form.append('brand_id', brandId);
  form.append('content_path', contentPath);
  if (campaignGoalId) {
    form.append('campaign_goal_id', campaignGoalId);
  }
  if (followerCount && followerCount > 0) {
    form.append('follower_count', String(followerCount));
  }

  const res = await fetch(`${base}/api/content/generate`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      // keep raw text
    }
    throw new Error(detail || `API error ${res.status}`);
  }

  const data = (await res.json()) as GeneratedContent;
  return { ...data, source: 'api' };
}

export async function scoreCaptionViaApi(
  imageUri: string,
  caption: string,
  moodId: string,
  brandId: string,
  followerCount?: number,
  bestCaption?: string,
  bestScore?: number,
): Promise<CaptionScoreResult> {
  const base = apiBase();
  if (!base) {
    throw new Error('VITE_API_URL is not set.');
  }

  const form = new FormData();
  const blob = await uriToBlob(imageUri);
  form.append('image', blob, 'upload.jpg');
  form.append('caption', caption);
  form.append('mood_id', moodId);
  form.append('brand_id', brandId);
  if (followerCount && followerCount > 0) {
    form.append('follower_count', String(followerCount));
  }
  if (bestCaption) {
    form.append('best_caption', bestCaption);
  }
  if (bestScore != null && bestScore > 0) {
    form.append('best_score', String(bestScore));
  }

  const res = await fetch(`${base}/api/content/score-caption`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      // keep raw text
    }
    throw new Error(detail || `API error ${res.status}`);
  }

  return res.json() as Promise<CaptionScoreResult>;
}
