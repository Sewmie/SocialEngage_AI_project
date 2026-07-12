export type BrandProfile = {
  id: string;
  label: string;
  voice: string;
};

/** Marketing / brand personalities (mirrors backend `brand_engine.py`). */
export const BRAND_PROFILES: BrandProfile[] = [
  { id: 'casual_creator', label: 'Casual creator', voice: 'relatable influencer tone' },
  { id: 'local_sme', label: 'Local SME', voice: 'community small business' },
  { id: 'luxury_brand', label: 'Luxury brand', voice: 'refined premium minimal' },
  { id: 'corporate', label: 'Corporate', voice: 'professional brand-safe' },
  { id: 'youth_startup', label: 'Youth startup', voice: 'bold innovative startup' },
];

export function brandById(id: string | undefined): BrandProfile {
  if (!id) return BRAND_PROFILES[0];
  return BRAND_PROFILES.find((b) => b.id === id) ?? BRAND_PROFILES[0];
}
