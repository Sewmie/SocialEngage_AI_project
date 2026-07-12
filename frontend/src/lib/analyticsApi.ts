function apiBase(): string {
  const url = import.meta.env.VITE_API_URL?.trim();
  return url && url.length > 0 ? url.replace(/\/$/, '') : '';
}

export type PredictionStats = {
  total_predictions: number;
  avg_top_score: number | null;
  min_top_score: number | null;
  max_top_score: number | null;
};

export type PredictionLog = {
  id: number;
  created_at: string;
  brand_id: string;
  mood_id: string;
  content_path: string;
  campaign_goal_id: string | null;
  filter_name: string;
  top_caption: string;
  top_score: number;
  popularity_level: string;
  caption_count: number;
  hashtag_count: number;
  score_delta: number | null;
  factors: Record<string, number>;
};

export type ModelMetrics = {
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  n_train: number | null;
  n_test: number | null;
  clip_features: boolean | null;
};

async function fetchJson<T>(path: string): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new Error('VITE_API_URL is not set.');
  }
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Error(`Analytics API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(apiBase());
}

export async function fetchPredictionStats(): Promise<PredictionStats> {
  return fetchJson<PredictionStats>('/api/analytics/stats');
}

export async function fetchRecentPredictions(limit = 20): Promise<PredictionLog[]> {
  const data = await fetchJson<{ predictions: PredictionLog[] }>(
    `/api/analytics/recent?limit=${limit}`,
  );
  return data.predictions;
}

export async function fetchModelMetrics(): Promise<ModelMetrics> {
  return fetchJson<ModelMetrics>('/api/analytics/model-metrics');
}
