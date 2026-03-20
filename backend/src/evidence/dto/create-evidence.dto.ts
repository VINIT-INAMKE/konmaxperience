import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export enum EvidenceType {
  PHOTO = 'photo',
  DOC = 'doc',
  VIDEO = 'video',
  LINK = 'link',
  NOTE = 'note',
}

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
