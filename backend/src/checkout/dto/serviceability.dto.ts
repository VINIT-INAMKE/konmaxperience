import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { OrderChannel } from '@prisma/client';

/**
 * `POST /customer/checkout/serviceability` — "can you reach this pincode?",
 * asked at the address step, before a quote exists.
 *
 * Deliberately *not* an address id: the customer is typing a new address and
 * has nothing to reference yet. That is the whole reason the route exists.
 */
export class ServiceabilityDto {
  /** Six digits, as `CreateAddressDto.pincode` — plus the digits-only rule it omits. */
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode: string;

  @IsOptional()
  @IsEnum(OrderChannel)
  @IsIn([OrderChannel.takeaway, OrderChannel.delivery])
  channel?: OrderChannel;
}
