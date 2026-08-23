import { ApprovalMode } from '@prisma/client';
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

/**
 * `scope` and `domain` are the policy's identity (`@@unique([node_id, scope, domain])`)
 * and are deliberately absent: to move a policy, delete it and create a new one.
 */
export class UpdateApprovalPolicyDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  required_role_codes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  min_approvals?: number;

  @IsOptional()
  @IsEnum(ApprovalMode)
  mode?: ApprovalMode;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
