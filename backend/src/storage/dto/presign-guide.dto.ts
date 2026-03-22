import { IsString, IsNotEmpty, IsNumber, IsIn, Min, Max } from 'class-validator';

export class PresignGuideDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;

  @IsNumber()
  @Min(1)
  @Max(10485760)
  fileSize: number;
}
