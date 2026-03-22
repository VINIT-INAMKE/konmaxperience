import { IsUUID, IsDateString } from 'class-validator';

export class CreateDelegationDto {
  @IsUUID()
  from_user_id: string;

  @IsUUID()
  to_user_id: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}
