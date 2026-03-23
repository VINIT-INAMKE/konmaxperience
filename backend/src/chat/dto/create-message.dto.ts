import { IsString, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  attachment_key?: string;

  @IsString()
  @IsOptional()
  attachment_url?: string;

  @IsString()
  @IsOptional()
  attachment_name?: string;

  @IsString()
  @IsOptional()
  attachment_type?: string;
}
