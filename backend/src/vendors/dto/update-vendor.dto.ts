import { IsString, IsOptional, IsEmail, IsIn } from 'class-validator';

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  payment_terms?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
