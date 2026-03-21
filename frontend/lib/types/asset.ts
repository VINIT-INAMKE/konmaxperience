export type AssetStatus = 'draft' | 'in_review' | 'approved' | 'rejected';
export type AssetType = 'recipe' | 'sop' | 'menu' | 'cost_sheet' | 'training_doc';

export interface Asset {
  id: string;
  name: string;
  asset_type: AssetType;
  linked_task_id: string | null;
  linked_brand_id: string | null;
  linked_brand?: { id: string; name: string } | null;
  url: string;
  status: AssetStatus;
  created_by: string;
  creator?: { id: string; name: string };
  created_at: string;
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  recipe: 'Recipe',
  sop: 'SOP',
  menu: 'Menu',
  cost_sheet: 'Cost Sheet',
  training_doc: 'Training Doc',
};

export const ASSET_STATUSES: AssetStatus[] = ['draft', 'in_review', 'approved', 'rejected'];
export const ASSET_TYPES: AssetType[] = ['recipe', 'sop', 'menu', 'cost_sheet', 'training_doc'];

// MIME types allowed for asset uploads (same as evidence)
export const ASSET_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'video/webm',
]);
export const ASSET_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
