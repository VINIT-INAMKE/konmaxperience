import { BadRequestException } from '@nestjs/common';
import { DELETE_BATCH_LIMIT, StorageService } from './storage.service';

// Mock the R2 client and presigner to avoid real AWS calls
const mockSend = jest.fn();

jest.mock('./r2.config', () => ({
  createR2Client: jest.fn(() => ({ send: mockSend })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(() =>
    Promise.resolve('https://mock-presigned-url.example.com'),
  ),
}));

// The command classes are recorded as `{ input }` so a spec can assert on what
// the service asked for without pulling in the real SDK.
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn((input: unknown) => ({ type: 'put', input })),
  ListObjectsV2Command: jest.fn((input: unknown) => ({ type: 'list', input })),
  DeleteObjectsCommand: jest.fn((input: unknown) => ({
    type: 'delete',
    input,
  })),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const env: Record<string, string> = {
          R2_ENDPOINT: 'https://r2.example.com',
          R2_ACCESS_KEY_ID: 'test-key',
          R2_SECRET_ACCESS_KEY: 'test-secret',
          R2_BUCKET_NAME: 'test-bucket',
          R2_PUBLIC_URL: 'https://cdn.example.com',
        };
        return env[key];
      }),
    };
    mockSend.mockReset();
    service = new StorageService(mockConfigService as any);
  });

  describe('validatePresignRequest', () => {
    it('allows image/jpeg', () => {
      expect(() =>
        service.validatePresignRequest('image/jpeg', 1024),
      ).not.toThrow();
    });

    it('allows application/pdf', () => {
      expect(() =>
        service.validatePresignRequest('application/pdf', 1024),
      ).not.toThrow();
    });

    it('allows video/mp4', () => {
      expect(() =>
        service.validatePresignRequest('video/mp4', 1024),
      ).not.toThrow();
    });

    it('throws BadRequestException for application/x-executable', () => {
      expect(() =>
        service.validatePresignRequest('application/x-executable', 1024),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for text/html', () => {
      expect(() =>
        service.validatePresignRequest('text/html', 1024),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for fileSize > 10 MB', () => {
      const overSize = 10 * 1024 * 1024 + 1;
      expect(() =>
        service.validatePresignRequest('image/jpeg', overSize),
      ).toThrow(BadRequestException);
    });

    it('allows fileSize exactly 10 MB', () => {
      const exactSize = 10 * 1024 * 1024;
      expect(() =>
        service.validatePresignRequest('image/jpeg', exactSize),
      ).not.toThrow();
    });
  });

  describe('buildStorageKey', () => {
    it('returns evidence/{taskId}/{timestamp}-{filename} format', () => {
      const key = service.buildStorageKey('task-123', 'photo.jpg');
      expect(key).toMatch(/^evidence\/task-123\/\d+-photo\.jpg$/);
    });

    it('sanitizes special characters in filename', () => {
      const key = service.buildStorageKey('task-123', 'my file (1).jpg');
      expect(key).toMatch(/^evidence\/task-123\/\d+-my_file__1_\.jpg$/);
    });
  });

  describe('getPublicUrl', () => {
    it('returns {R2_PUBLIC_URL}/{key} format', () => {
      const url = service.getPublicUrl('evidence/task-123/12345-photo.jpg');
      expect(url).toBe(
        'https://cdn.example.com/evidence/task-123/12345-photo.jpg',
      );
    });
  });
  describe('listKeys', () => {
    it('returns key and lastModified for every object under the prefix', async () => {
      const modified = new Date('2026-08-01T00:00:00.000Z');
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'exports/a.csv', LastModified: modified },
          { Key: 'exports/b.csv' },
        ],
        IsTruncated: false,
      });

      await expect(service.listKeys('exports/')).resolves.toEqual([
        { key: 'exports/a.csv', lastModified: modified },
        { key: 'exports/b.csv', lastModified: null },
      ]);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].input).toEqual({
        Bucket: 'test-bucket',
        Prefix: 'exports/',
        ContinuationToken: undefined,
      });
    });

    it('follows the continuation token until the listing is exhausted', async () => {
      mockSend
        .mockResolvedValueOnce({
          Contents: [{ Key: 'evidence/1' }],
          IsTruncated: true,
          NextContinuationToken: 'page-2',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'evidence/2' }],
          IsTruncated: true,
          NextContinuationToken: 'page-3',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'evidence/3' }],
          IsTruncated: false,
          // A stale token on the last page must not restart the loop.
          NextContinuationToken: 'page-4',
        });

      const objects = await service.listKeys('evidence/');

      expect(objects.map((o) => o.key)).toEqual([
        'evidence/1',
        'evidence/2',
        'evidence/3',
      ]);
      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend.mock.calls[1][0].input.ContinuationToken).toBe('page-2');
      expect(mockSend.mock.calls[2][0].input.ContinuationToken).toBe('page-3');
    });

    it('tolerates an empty bucket and a keyless entry', async () => {
      mockSend.mockResolvedValueOnce({ IsTruncated: false });
      await expect(service.listKeys('exports/')).resolves.toEqual([]);

      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: undefined }, { Key: '' }],
        IsTruncated: false,
      });
      await expect(service.listKeys('exports/')).resolves.toEqual([]);
    });
  });

  describe('deleteKeys', () => {
    it('deletes in one call and returns the count', async () => {
      mockSend.mockResolvedValueOnce({});

      await expect(service.deleteKeys(['a', 'b'])).resolves.toBe(2);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].input).toEqual({
        Bucket: 'test-bucket',
        Delete: { Objects: [{ Key: 'a' }, { Key: 'b' }], Quiet: true },
      });
    });

    it('chunks at the 1000-key S3 batch limit', async () => {
      const keys = Array.from({ length: 2001 }, (_, i) => `evidence/${i}`);
      mockSend.mockResolvedValue({});

      await expect(service.deleteKeys(keys)).resolves.toBe(2001);

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend.mock.calls[0][0].input.Delete.Objects).toHaveLength(
        DELETE_BATCH_LIMIT,
      );
      expect(mockSend.mock.calls[1][0].input.Delete.Objects).toHaveLength(
        DELETE_BATCH_LIMIT,
      );
      expect(mockSend.mock.calls[2][0].input.Delete.Objects).toHaveLength(1);
    });

    it('does not count keys the API reported as errors', async () => {
      mockSend.mockResolvedValueOnce({
        Errors: [{ Key: 'b', Code: 'AccessDenied' }],
      });

      await expect(service.deleteKeys(['a', 'b'])).resolves.toBe(1);
    });

    it('sends nothing for an empty key list', async () => {
      await expect(service.deleteKeys([])).resolves.toBe(0);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
