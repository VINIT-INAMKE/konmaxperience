import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, IsIn, Min, MaxLength } from 'class-validator';

export class CreatePageDto {
  @IsUUID()
  section_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

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
}
