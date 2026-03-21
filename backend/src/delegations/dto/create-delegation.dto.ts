import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  @IsNotEmpty()
  from_user_id: string;

  @IsString()
  @IsNotEmpty()
  to_user_id: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}
