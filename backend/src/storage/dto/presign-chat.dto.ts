import { IsString, IsNotEmpty, IsNumber, IsIn, Min, Max } from 'class-validator';

export class PresignChatDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsIn([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ])
  contentType: string;

  @IsNumber()
  @Min(1)
  @Max(26214400) // 25 MB
  fileSize: number;
}
