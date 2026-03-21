import { IsString, MinLength } from 'class-validator';

export class OverrideApprovalDto {
  @IsString()
  @MinLength(10, { message: 'Override reason must be at least 10 characters' })
  reason: string;
}
