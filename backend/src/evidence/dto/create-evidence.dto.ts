import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { EvidenceType } from '@prisma/client';

export class CreateEvidenceDto {
  @IsEnum(EvidenceType)
  type: EvidenceType;

  /**
   * A `note` carries its substance in `notes` and stores straight to Postgres,
   * so it is the one type allowed an empty url (QA-03 finding: the note form
   * posts `url: ''` and was 400-blocked on every submission).
   */
  @ValidateIf((o: CreateEvidenceDto) => o.type !== EvidenceType.note)
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
