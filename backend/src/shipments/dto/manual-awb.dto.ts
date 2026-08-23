import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * `POST /shipments/:id/awb`.
 *
 * Every field is optional because the body only matters to the `manual`
 * provider: staff paste the number the local courier wrote on the parcel. With
 * `shiprocket` configured the API issues the AWB and the courier name, and
 * whatever is in this body loses to the provider's answer — `ShipmentsService`
 * resolves `provider.assignAwb().awb ?? dto.awb`, so a pasted value is a
 * fallback, never an override.
 */
export class ManualAwbDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  awb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  courier_name?: string;

  /**
   * The page a customer opens to follow the parcel. Kept even on the Shiprocket
   * path, because the adapter only learns a tracking URL at `track()` time and
   * staff often have it earlier.
   */
  @IsOptional()
  @IsUrl()
  @MaxLength(512)
  tracking_url?: string;
}

/** `POST /shipments/:id/cancel` — the reason is stored on the `ShipmentEvent.raw`. */
export class CancelShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}
