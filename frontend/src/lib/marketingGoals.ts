export type CampaignGoal = {
  id: string;
  label: string;
  prompt: string;
};

export const CAMPAIGN_GOALS: CampaignGoal[] = [
  {
    id: 'awareness',
    label: 'Brand awareness',
    prompt: 'build recognition, tell brand story, memorable positioning',
  },
  {
    id: 'promotion',
    label: 'Promotion / sale',
    prompt: 'drive urgency, highlight offer or discount, clear value proposition',
  },
  {
    id: 'product',
    label: 'Product launch',
    prompt: 'showcase features, benefits, why buy now, product-first messaging',
  },
  {
    id: 'lead',
    label: 'Lead generation',
    prompt: 'encourage DM, link in bio, sign-up, inquiry or booking',
  },
  {
    id: 'community',
    label: 'Community & trust',
    prompt: 'humanize brand, social proof, customer-centric, local SME warmth',
  },
];

export function campaignGoalById(id: string | undefined): CampaignGoal {
  if (!id) return CAMPAIGN_GOALS[0];
  return CAMPAIGN_GOALS.find((g) => g.id === id) ?? CAMPAIGN_GOALS[0];
}
