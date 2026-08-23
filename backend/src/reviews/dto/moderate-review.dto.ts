import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of `PATCH /reviews/:id/publish` and `PATCH /reviews/:id/hide`
 * (staff, `MANAGE_OPS`).
 *
 * The verb is in the path, not the body — a moderator cannot mistype a status,
 * and the API appendix's bodyless call still validates because every field here
 * is optional. The only field is the moderator's reason, which is written into
 * the `AuditEvent.after` payload; it is deliberately **not** a column, because
 * `Review` has no moderation-note field and the audit trail is where SPEC §3
 * puts the "why" of a staff decision.
 */
export class ModerateReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
