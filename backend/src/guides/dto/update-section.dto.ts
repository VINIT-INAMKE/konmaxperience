import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, IsIn, Min, MaxLength } from 'class-validator';

export class UpdateSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  icon?: string;

  @IsString()
  @MaxLength(7)
  @IsOptional()
  accent_color?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  role_codes?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  sort_order?: number;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  slug?: string;
}
