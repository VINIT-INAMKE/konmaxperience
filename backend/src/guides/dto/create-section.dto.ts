import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, IsIn, Min, MaxLength } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;

  @IsString()
  @IsOptional()
  @MaxLength(7)
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
}
