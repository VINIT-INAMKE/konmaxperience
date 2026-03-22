import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn, Min, MaxLength } from 'class-validator';

export class UpdatePageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  summary?: string;

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
