export type EvidenceType = 'photo' | 'doc' | 'video' | 'link' | 'note';
export type EvidenceApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Evidence {
  id: string;
  task_id: string;
  uploaded_by: string;
  uploader?: { id: string; name: string };
  type: EvidenceType;
  url: string;
  notes: string | null;
  approval_status: EvidenceApprovalStatus;
  reviewed_by: string | null;
  reviewer?: { id: string; name: string } | null;
  reviewed_at: string | null;
  created_at: string;
}

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  photo: 'Photo',
  doc: 'Document',
  video: 'Video',
  link: 'Link',
  note: 'Note',
};

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'video/webm',
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function getEvidenceTypeFromMime(mime: string): EvidenceType {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  return 'doc';
}
