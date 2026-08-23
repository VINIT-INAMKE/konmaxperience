import { BadRequestException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * SPEC §4.4 / §6.4 — `POST /approvals/:id/decide`.
 *
 * Two spellings are accepted because the ops frontend posts
 * `{ decision: 'approve' | 'reject', note? }` while the plan's service contract
 * speaks `{ status: ApprovalStatus, notes? }`. Both are declared as real DTO
 * properties: the global `ValidationPipe` runs with `forbidNonWhitelisted: true`,
 * so an undeclared alias would be a 400 rather than a synonym.
 */
export const DECISION_ALIASES = {
  approve: ApprovalStatus.approved,
  approved: ApprovalStatus.approved,
  reject: ApprovalStatus.rejected,
  rejected: ApprovalStatus.rejected,
} as const;

export type DecisionAlias = keyof typeof DECISION_ALIASES;

const DECISION_VALUES = Object.keys(DECISION_ALIASES) as DecisionAlias[];

export class DecideApprovalDto {
  /** Canonical form: `approved` | `rejected`. */
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  /** Frontend alias: `approve` | `reject` (also accepts the past tense). */
  @IsOptional()
  @IsIn(DECISION_VALUES)
  decision?: DecisionAlias;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Frontend alias for `notes`. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export interface NormalisedDecision {
  status: Exclude<ApprovalStatus, 'pending'>;
  notes?: string;
}

/**
 * Collapses the two spellings into one decision and enforces SPEC §6.4's
 * "required note on reject". Called by the controller so the rule holds for
 * `/decide`, `/approve` and `/reject` alike.
 */
export function normaliseDecision(dto: DecideApprovalDto): NormalisedDecision {
  const status =
    dto.status ?? (dto.decision ? DECISION_ALIASES[dto.decision] : undefined);

  if (!status) {
    throw new BadRequestException(
      "A decision is required: send { decision: 'approve' | 'reject' }",
    );
  }
  if (status === ApprovalStatus.pending) {
    throw new BadRequestException('`pending` is not a decision');
  }

  const notes = (dto.notes ?? dto.note ?? '').trim() || undefined;
  if (status === ApprovalStatus.rejected && !notes) {
    throw new BadRequestException('A note is required when rejecting');
  }

  return { status, notes };
}
