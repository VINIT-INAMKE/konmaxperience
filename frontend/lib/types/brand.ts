export type BrandStatus = 'idea' | 'planning' | 'development' | 'active' | 'paused';
export type BrandType = 'food' | 'art' | 'lifestyle';

export interface Brand {
  id: string;
  name: string;
  brand_type: BrandType;
  status: BrandStatus;
  owner_user_id: string | null;
  owner?: { id: string; name: string } | null;
  notes: string | null;
}

export const BRAND_STATUS_LABELS: Record<BrandStatus, string> = {
  idea: 'Idea',
  planning: 'Planning',
  development: 'Development',
  active: 'Active',
  paused: 'Paused',
};

export const BRAND_TYPE_LABELS: Record<BrandType, string> = {
  food: 'Food',
  art: 'Art',
  lifestyle: 'Lifestyle',
};

export const BRAND_STATUSES: BrandStatus[] = ['idea', 'planning', 'development', 'active', 'paused'];
export const BRAND_TYPES: BrandType[] = ['food', 'art', 'lifestyle'];
