export type EvidenceType = 'image' | 'document' | 'video' | 'link' | 'note' | 'system';
export type EvidenceSource = 'manual' | 'bridge';
/** Prisma `ApprovalStatus` — shared by Evidence.approval_status and Approval.status. */
export type EvidenceApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Evidence {
  id: string;
  task_id: string;
  /**
   * SPEC §6.4 — the lineage the "Quest › Task" chip renders. `GET /evidence`
   * selects it; the per-task and post-upload responses do not, so it is
   * optional and the chip stands down where it is absent.
   */
  task?: {
    id: string;
    title: string;
    quest?: { id: string; title: string } | null;
    mission?: { id: string; title: string } | null;
  } | null;
  uploaded_by: string;
  uploader?: { id: string; name: string };
  type: EvidenceType;
  source: EvidenceSource;
  bridge_event: string | null;
  url: string;
  notes: string | null;
  approval_status: EvidenceApprovalStatus;
  reviewed_by: string | null;
  reviewer?: { id: string; name: string } | null;
  reviewed_at: string | null;
  created_at: string;
}

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  image: 'Image',
  document: 'Document',
  video: 'Video',
  link: 'Link',
  note: 'Note',
  system: 'System',
};

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSource, string> = {
  manual: 'Manual upload',
  bridge: 'Auto-captured',
};

export const EVIDENCE_APPROVAL_STATUS_LABELS: Record<EvidenceApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'video/webm',
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function getEvidenceTypeFromMime(mime: string): EvidenceType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}
