import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * `POST /shipments/pack` (staff, `MANAGE_OPS`).
 *
 * Packing is a physical act recorded against an **order**, not a shipment:
 * `Shipment.order_id` is unique (plan decision 8), so the order id is the whole
 * identity of the row this creates and packing twice is a no-op that returns the
 * first shipment.
 *
 * Both overrides exist because the packer holds the parcel and the catalog does
 * not: `Product.weight_grams` is a planning figure, the scale is the truth.
 */
export class PackShipmentDto {
  @IsUUID()
  order_id: string;

  /**
   * Gross parcel weight. Omitted, the service sums `Product.weight_grams × qty`
   * over the shipped lines and falls back to
   * `SystemSetting['shipping'].default_weight_grams` when the catalog is silent.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  weight_grams?: number;

  /**
   * Which registered pickup address the courier collects from. Defaults to
   * `SystemSetting['shipping'].pickup_location_code`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pickup_location_code?: string;
}
