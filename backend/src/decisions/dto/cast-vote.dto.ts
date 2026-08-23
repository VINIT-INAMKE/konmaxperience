import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { VoteValue } from '@prisma/client';

/** Body of `POST /decisions/:id/votes` (SPEC §4.4, §9). */
export class CastVoteDto {
  @IsEnum(VoteValue)
  vote: VoteValue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
