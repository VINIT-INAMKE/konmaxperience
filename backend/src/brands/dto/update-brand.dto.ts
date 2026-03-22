import { IsString, IsOptional, IsIn, IsUUID } from 'class-validator';

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['food', 'art', 'lifestyle'])
  brand_type?: string;

  @IsOptional()
  @IsIn(['idea', 'planning', 'development', 'active', 'paused'])
  status?: string;

  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
