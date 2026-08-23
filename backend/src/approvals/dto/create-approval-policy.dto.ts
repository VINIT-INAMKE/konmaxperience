import { ApprovalMode, ApprovalScope, TaskDomain } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateApprovalPolicyDto {
  @IsEnum(ApprovalScope)
  scope!: ApprovalScope;

  /** `null`/omitted = the catch-all fallback row for this scope. */
  @IsOptional()
  @IsEnum(TaskDomain)
  domain?: TaskDomain | null;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  required_role_codes!: string[];

  @IsInt()
  @Min(1)
  min_approvals!: number;

  @IsEnum(ApprovalMode)
  mode!: ApprovalMode;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
