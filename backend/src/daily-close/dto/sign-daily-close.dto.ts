import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * RUN-02 — the body of `POST /daily-close/:date/sign`.
 *
 * `notes` is the signatory's own remark on the day ("power cut 19:00–20:30, two
 * orders comped"). It is frozen with the rest of the row, so it is bounded here
 * rather than at the column.
 */
export class SignDailyCloseDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
