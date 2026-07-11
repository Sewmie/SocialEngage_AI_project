export type VignetteSpec = {
  colors: readonly string[];
  locations?: readonly number[];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export type FilterPreset = {
  id: string;
  name: string;
  /** Soft color grade (multiply-style overlay). */
  overlay: string;
  /** Optional edge darkening / tone for a more editorial look. */
  vignette?: VignetteSpec;
};

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', name: 'Original', overlay: 'transparent' },
  {
    id: 'studio',
    name: 'Studio clean',
    overlay: 'rgba(255, 255, 255, 0.04)',
    vignette: {
      colors: ['transparent', 'rgba(0,0,0,0.18)'],
      locations: [0.35, 1],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    overlay: 'rgba(25, 25, 35, 0.12)',
    vignette: {
      colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)'],
      locations: [0.45, 1],
      start: { x: 0.5, y: 0.2 },
      end: { x: 0.5, y: 1 },
    },
  },
  { id: 'warm', name: 'Warm film', overlay: 'rgba(255, 175, 120, 0.12)' },
  { id: 'golden', name: 'Golden hour', overlay: 'rgba(255, 200, 100, 0.16)' },
  { id: 'cool', name: 'Cool steel', overlay: 'rgba(120, 175, 255, 0.11)' },
  { id: 'arctic', name: 'Arctic', overlay: 'rgba(180, 210, 255, 0.14)' },
  {
    id: 'moody',
    name: 'Moody pro',
    overlay: 'rgba(35, 30, 70, 0.18)',
    vignette: {
      colors: ['transparent', 'rgba(10,5,30,0.45)'],
      locations: [0.4, 1],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    },
  },
  { id: 'soft', name: 'Soft matte', overlay: 'rgba(255, 255, 255, 0.09)' },
  { id: 'cream', name: 'Cream luxe', overlay: 'rgba(255, 245, 220, 0.14)' },
  { id: 'vintage', name: 'Vintage print', overlay: 'rgba(200, 165, 120, 0.14)' },
  { id: 'mint', name: 'Fresh mint', overlay: 'rgba(160, 230, 200, 0.09)' },
  { id: 'rose', name: 'Rose quartz', overlay: 'rgba(255, 180, 200, 0.11)' },
  {
    id: 'noir',
    name: 'Noir B&W',
    overlay: 'rgba(0, 0, 0, 0.25)',
    vignette: {
      colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)'],
      locations: [0.5, 1],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    },
  },
  {
    id: 'magazine',
    name: 'Magazine',
    overlay: 'rgba(255, 255, 255, 0.06)',
    vignette: {
      colors: ['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.2)'],
      locations: [0, 0.5, 1],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    },
  },
];

export function presetById(id: string): FilterPreset {
  return FILTER_PRESETS.find((p) => p.id === id) ?? FILTER_PRESETS[0];
}
