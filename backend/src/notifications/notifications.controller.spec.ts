import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';

async function build(env: Record<string, string | undefined>) {
  const processor = { process: jest.fn().mockResolvedValue(undefined) };
  const module = await Test.createTestingModule({
    controllers: [NotificationsController],
    providers: [
      { provide: NotificationsService, useValue: {} },
      { provide: NotificationsProcessor, useValue: processor },
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
    ],
  }).compile();
  return { controller: module.get(NotificationsController), processor };
}

const body = { jobName: 'send-email', data: { to: 'a@b.c' } };

describe('NotificationsController.handleQStashWebhook', () => {
  it('returns 403 when signing keys are not configured', async () => {
    const { controller, processor } = await build({ NODE_ENV: 'production' });
    await expect(
      controller.handleQStashWebhook(body, undefined as any),
    ).rejects.toThrow(ForbiddenException);
    expect(processor.process).not.toHaveBeenCalled();
  });

  it('returns 403 in production even when QSTASH_ALLOW_UNSIGNED=true', async () => {
    const { controller } = await build({
      NODE_ENV: 'production',
      QSTASH_ALLOW_UNSIGNED: 'true',
    });
    await expect(
      controller.handleQStashWebhook(body, undefined as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('processes unsigned jobs only when QSTASH_ALLOW_UNSIGNED=true outside production', async () => {
    const { controller, processor } = await build({
      NODE_ENV: 'development',
      QSTASH_ALLOW_UNSIGNED: 'true',
    });
    await expect(
      controller.handleQStashWebhook(body, undefined as any),
    ).resolves.toEqual({ status: 'ok' });
    expect(processor.process).toHaveBeenCalledWith('send-email', {
      to: 'a@b.c',
    });
  });
});
