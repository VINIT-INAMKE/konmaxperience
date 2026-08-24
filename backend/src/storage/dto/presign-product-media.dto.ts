import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * `POST /storage/presign-product-media` (staff, `MANAGE_OPS`) — `OPS-01`.
 *
 * `productId` is part of the key, not just metadata: media land under
 * `product-media/{productId}/…` so an object can be traced back to its product
 * from the bucket alone, the way evidence keys carry their task id.
 *
 * Images only. `POST /catalog/products/:id/media` stores a URL that the
 * storefront renders through `next/image`, and a PDF or a spreadsheet has no
 * meaning there.
 */
export class PresignProductMediaDto {
  @IsUUID()
  productId: string;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;

  @IsNumber()
  @Min(1)
  @Max(10485760)
  fileSize: number;
}
