import type { ContentPath } from './contentPath';
import type { GeneratedContent } from './types';

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
  filterName: string,
  moodId: string,
  brandId: string,
  contentPath: ContentPath = 'marketing',
  campaignGoalId?: string,
): Promise<GeneratedContent> {
  const base = apiBase();
  if (!base) {
    throw new Error('VITE_API_URL is not set.');
  }

  const form = new FormData();
  const blob = await uriToBlob(imageUri);
  form.append('image', blob, 'upload.jpg');
  form.append('filter_name', filterName);
  form.append('mood_id', moodId);
  form.append('brand_id', brandId);
  form.append('content_path', contentPath);
  if (campaignGoalId) {
    form.append('campaign_goal_id', campaignGoalId);
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
