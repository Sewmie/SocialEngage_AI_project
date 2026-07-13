import type { ContentPath } from './contentPath';

export type EditorHandoff = {
  imageBlobUrl: string;
  aspectLabel: string;
  moodId: string;
  brandId: string;
  contentPath: ContentPath;
  campaignGoalId?: string;
  followerCount: number;
};

let session: EditorHandoff | null = null;

export function saveEditorHandoff(data: EditorHandoff) {
  session = data;
}

export function loadEditorHandoff(): EditorHandoff | null {
  return session;
}

export function clearEditorHandoff() {
  session = null;
}
