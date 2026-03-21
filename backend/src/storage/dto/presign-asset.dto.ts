import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class PresignAssetDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsNumber()
  @Min(1)
  @Max(10485760)
  fileSize: number;
}
