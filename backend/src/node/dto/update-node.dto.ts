import { IsOptional, IsString, IsNotEmpty, Length } from 'class-validator';

export class UpdateNodeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** IANA zone id, e.g. "Asia/Kolkata". */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
