import { IsString, IsNotEmpty, IsNumber, IsUUID, Min, Max } from 'class-validator';

export class PresignDto {
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

  @IsUUID()
  taskId: string;
}
