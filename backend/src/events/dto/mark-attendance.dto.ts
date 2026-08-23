import { IsIn, IsUUID } from 'class-validator';
import { BookingStatus } from '@prisma/client';

/**
 * The two terminal states a host can put a confirmed booking into on the day
 * (SPEC §5.2 step 5). `held`, `confirmed` and `cancelled` are reachable only
 * from checkout, the hold sweep or a refund — never from this endpoint, which
 * is why the union is narrower than `BookingStatus`.
 */
export type AttendanceStatus =
  | typeof BookingStatus.attended
  | typeof BookingStatus.no_show;

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  BookingStatus.attended,
  BookingStatus.no_show,
];

export class MarkAttendanceDto {
  @IsUUID()
  booking_id: string;

  @IsIn(ATTENDANCE_STATUSES as AttendanceStatus[])
  status: AttendanceStatus;
}
