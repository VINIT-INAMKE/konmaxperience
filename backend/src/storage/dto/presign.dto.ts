import { IsString, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class PresignDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsNumber()
  @Min(1)
  fileSize: number;

  @IsUUID()
  taskId: string;
}
