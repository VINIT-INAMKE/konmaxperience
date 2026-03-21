import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['kitchen', 'dining', 'outdoor', 'workspace', 'storage', 'leisure'])
  zone_type?: string;

  @IsOptional()
  @IsIn(['planned', 'setup', 'active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  owner_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
