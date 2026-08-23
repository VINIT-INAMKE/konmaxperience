import { ApprovalEntityType, ApprovalStatus } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * SPEC §6.2/§9 — `GET /approvals?mine=1&status=pending`. Query strings arrive as
 * strings, so `mine` is `'0' | '1'` rather than a boolean and `limit` is
 * validated as a numeric string (SPEC §9: default 50, max 200).
 */
export class ListApprovalsDto {
  @IsOptional()
  @IsIn(['0', '1'])
  mine?: '0' | '1';

  @IsOptional()
  @IsEnum(ApprovalEntityType)
  entity_type?: ApprovalEntityType;

  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  /** ISO-8601 `created_at` of the last row of the previous page. */
  @IsOptional()
  @IsString()
  cursor?: string;
}
