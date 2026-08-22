import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { EvidenceType } from '@prisma/client';

export class CreateEvidenceDto {
  @IsEnum(EvidenceType)
  type: EvidenceType;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
