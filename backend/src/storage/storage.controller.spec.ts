import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { PresignProductMediaDto } from './dto/presign-product-media.dto';

/**
 * `OPS-01` — `POST /storage/presign-product-media`.
 *
 * The staff catalog admin had no way to upload a product photo at all: the
 * three existing presign routes key into `evidence/`, `assets/`, `guide/` and
 * `chat/`, none of which the catalog media editor can use. Verified `404`
 * against a running server before this route existed.
 */

const PRODUCT_ID = '0ed3d5bf-25eb-420a-bbd4-882e930719b3';

function build() {
  const storageService = {
    validatePresignRequest: jest.fn(),
    generatePresignedPutUrl: jest
      .fn()
      .mockResolvedValue('https://r2.example.com/signed'),
    getPublicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  };
  const controller = new StorageController(
    storageService as unknown as StorageService,
    {} as never,
  );
  return { controller, storageService };
}

const dto = (over: Partial<PresignProductMediaDto> = {}) => ({
  productId: PRODUCT_ID,
  filename: 'mug.jpg',
  contentType: 'image/jpeg',
  fileSize: 2048,
  ...over,
});

describe('StorageController.presignProductMedia', () => {
  it('returns the same { presignedUrl, key, publicUrl } triple as its siblings', async () => {
    const { controller, storageService } = build();

    const result = await controller.presignProductMedia(dto() as never);

    expect(Object.keys(result).sort()).toEqual([
      'key',
      'presignedUrl',
      'publicUrl',
    ]);
    expect(result.presignedUrl).toBe('https://r2.example.com/signed');
    expect(result.publicUrl).toBe(`https://cdn.example.com/${result.key}`);
    expect(storageService.generatePresignedPutUrl).toHaveBeenCalledWith(
      result.key,
      'image/jpeg',
    );
  });

  it('keys the object under its product so the bucket alone traces it back', async () => {
    const { controller } = build();

    const { key } = await controller.presignProductMedia(dto() as never);

    expect(key).toMatch(
      new RegExp(`^product-media/${PRODUCT_ID}/\\d+-mug\\.jpg$`),
    );
  });

  it('sanitises a filename so it cannot escape its own prefix', async () => {
    const { controller } = build();

    const { key } = await controller.presignProductMedia(
      dto({ filename: '../../etc/passwd .jpg' }) as never,
    );

    const prefix = `product-media/${PRODUCT_ID}/`;
    expect(key.startsWith(prefix)).toBe(true);
    // `..` survives as literal dots, which is harmless: every path separator
    // and space is replaced, so the filename collapses into exactly one flat
    // segment under its product prefix and cannot traverse out of it.
    expect(key.slice(prefix.length)).not.toContain('/');
    expect(key).toMatch(
      new RegExp(`^${prefix}\\d+-\\.\\._\\.\\._etc_passwd_\\.jpg$`),
    );
  });

  it('still runs the shared MIME and size validation', async () => {
    const { controller, storageService } = build();
    storageService.validatePresignRequest.mockImplementation(() => {
      throw new BadRequestException('nope');
    });

    await expect(
      controller.presignProductMedia(dto() as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storageService.generatePresignedPutUrl).not.toHaveBeenCalled();
  });

  it('is gated by MANAGE_OPS, matching POST /catalog/products/:id/media', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        StorageController.prototype.presignProductMedia,
      ),
    ).toBe(Permission.MANAGE_OPS);
  });
});

describe('PresignProductMediaDto', () => {
  const errors = (body: Record<string, unknown>) =>
    validate(plainToInstance(PresignProductMediaDto, body));

  it('accepts a well-formed image request', async () => {
    await expect(errors(dto())).resolves.toEqual([]);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'accepts %s',
    async (contentType) => {
      await expect(errors(dto({ contentType }))).resolves.toEqual([]);
    },
  );

  it.each(['application/pdf', 'video/mp4', 'text/html'])(
    'rejects %s — catalog media are rendered as images',
    async (contentType) => {
      const bad = await errors(dto({ contentType }));
      expect(bad.map((e) => e.property)).toContain('contentType');
    },
  );

  it('rejects a non-uuid productId', async () => {
    const bad = await errors(dto({ productId: 'not-a-uuid' }));
    expect(bad.map((e) => e.property)).toContain('productId');
  });

  it('rejects a file over 10 MB', async () => {
    const bad = await errors(dto({ fileSize: 10485761 }));
    expect(bad.map((e) => e.property)).toContain('fileSize');
  });
});
