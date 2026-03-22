import { BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';

// Mock the R2 client and presigner to avoid real AWS calls
jest.mock('./r2.config', () => ({
  createR2Client: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(() =>
    Promise.resolve('https://mock-presigned-url.example.com'),
  ),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
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
});
