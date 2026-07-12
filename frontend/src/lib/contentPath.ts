export type ContentPath = 'marketing' | 'casual';

export type ContentPathConfig = {
  id: ContentPath;
  label: string;
  subtitle: string;
  icon: 'briefcase' | 'camera';
  /** What the user gets on the results screen */
  outputs: string[];
};

export const CONTENT_PATHS: ContentPathConfig[] = [
  {
    id: 'marketing',
    label: 'Full analysis',
    subtitle: 'Engagement prediction with brand & campaign context',
    icon: 'briefcase',
    outputs: [
      'Engagement score & ML ranking',
      'Feature breakdown & tips',
      'Generated captions',
      'Recommended hashtags',
    ],
  },
  {
    id: 'casual',
    label: 'Quick analysis',
    subtitle: 'Engagement prediction for personal posts',
    icon: 'camera',
    outputs: ['Engagement score', 'Ranked captions', 'Light hashtags'],
  },
];

export function contentPathById(id: string | undefined): ContentPath {
  return id === 'casual' ? 'casual' : 'marketing';
}

export function isMarketingPath(path: ContentPath | string | undefined): boolean {
  return contentPathById(path) === 'marketing';
}
