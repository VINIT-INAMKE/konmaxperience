import { IsString, IsOptional, IsIn, IsUUID } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['draft', 'in_review', 'approved', 'rejected'])
  status?: string;

  @IsOptional()
  @IsUUID()
  linked_brand_id?: string;

  @IsOptional()
  @IsUUID()
  linked_task_id?: string;
}
