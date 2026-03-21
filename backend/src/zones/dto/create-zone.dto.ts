import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['kitchen', 'dining', 'outdoor', 'workspace', 'storage', 'leisure'])
  zone_type: string;

  @IsOptional()
  @IsString()
  owner_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
