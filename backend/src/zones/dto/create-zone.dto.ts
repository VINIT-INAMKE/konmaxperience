import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['kitchen', 'dining', 'outdoor', 'workspace', 'storage', 'leisure'])
  zone_type: string;

  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
