import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { MorningBriefController } from './morning-brief.controller';
import type { MorningBriefService } from './morning-brief.service';
import { REQUIRED_PERMISSION_KEY } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';

const DAY = '2026-08-24';

function buildService() {
  return {
    latestForUser: jest.fn().mockResolvedValue({ id: 'n-1' }),
    previousBusinessDate: jest.fn().mockResolvedValue(DAY),
    generateAndDeliver: jest.fn().mockResolvedValue({ business_date: DAY }),
  };
}

function request(userId = 'lead-1'): Request {
  return { user: { id: userId } } as unknown as Request;
}

describe('MorningBriefController', () => {
  let service: ReturnType<typeof buildService>;
  let controller: MorningBriefController;

  beforeEach(() => {
    service = buildService();
    controller = new MorningBriefController(
      service as unknown as MorningBriefService,
    );
  });

  describe('GET latest', () => {
    it('reads only the caller’s own brief', async () => {
      await controller.latest(request('lead-7'));
      expect(service.latestForUser).toHaveBeenCalledWith('lead-7');
    });

    it('carries no extra permission — the row already belongs to the caller', () => {
      expect(
        Reflect.getMetadata(
          REQUIRED_PERMISSION_KEY,
          MorningBriefController.prototype.latest,
        ),
      ).toBeUndefined();
    });
  });

  describe('POST generate', () => {
    it('is gated on MANAGE_SYSTEM', () => {
      expect(
        Reflect.getMetadata(
          REQUIRED_PERMISSION_KEY,
          MorningBriefController.prototype.generate,
        ),
      ).toBe(Permission.MANAGE_SYSTEM);
    });

    it('defaults to yesterday', async () => {
      await controller.generate();

      expect(service.previousBusinessDate).toHaveBeenCalled();
      expect(service.generateAndDeliver).toHaveBeenCalledWith(DAY);
    });

    it('re-runs an explicit day', async () => {
      await controller.generate('2026-07-01');

      expect(service.previousBusinessDate).not.toHaveBeenCalled();
      expect(service.generateAndDeliver).toHaveBeenCalledWith('2026-07-01');
    });

    it('rejects a date that is not a real calendar day before any query runs', async () => {
      await expect(controller.generate('2026-02-31')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.generateAndDeliver).not.toHaveBeenCalled();
    });
  });
});
