import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  MinLength,
  Length,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsIn(['Home', 'Work', 'Other'])
  label: string;

  @IsString()
  @MinLength(5)
  address: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsString()
  @Length(6, 6)
  pincode: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
