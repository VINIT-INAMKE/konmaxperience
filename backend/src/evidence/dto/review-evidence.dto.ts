import { IsString, IsNotEmpty } from 'class-validator';

export class ReviewEvidenceDto {
  @IsString()
  @IsNotEmpty()
  notes: string;
}
