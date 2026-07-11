export type AspectOption = { id: string; label: string; w: number; h: number };

export const ASPECT_OPTIONS: AspectOption[] = [
  { id: '1-1', label: 'Post 1:1', w: 1, h: 1 },
  { id: '4-5', label: 'Post 4:5', w: 4, h: 5 },
  { id: '9-16', label: 'Story 9:16', w: 9, h: 16 },
];

export function aspectById(id: string): AspectOption {
  return ASPECT_OPTIONS.find((a) => a.id === id) ?? ASPECT_OPTIONS[1];
}