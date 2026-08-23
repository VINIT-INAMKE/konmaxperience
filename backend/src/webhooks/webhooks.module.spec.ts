import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksModule } from './webhooks.module';
import { WebhooksController } from './webhooks.controller';
import { ShiprocketWebhookService } from './shiprocket-webhook.service';
import { mockPrisma } from '../test-utils/mock-providers';

/**
 * The unit suites wire both webhook services from explicit provider lists,
 * which proves nothing about `WebhooksModule.imports`. This compiles the *real*
 * graph, so a missing `ShipmentsModule` (for `ShipmentsService.applyStatus`) or
 * an unexported `WhatsAppService` fails here rather than at boot after a merge.
 * `PrismaModule` and `AuditModule` stand in for the `@Global()` modules
 * `AppModule` supplies. `.compile()` does not run lifecycle hooks, so no
 * Redis/Pusher socket is opened.
 */
describe('WebhooksModule', () => {
  it('resolves the Shiprocket webhook from the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuditModule,
        EventEmitterModule.forRoot(),
        WebhooksModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma())
      .compile();

    expect(moduleRef.get(ShiprocketWebhookService)).toBeInstanceOf(
      ShiprocketWebhookService,
    );
    expect(moduleRef.get(WebhooksController)).toBeInstanceOf(
      WebhooksController,
    );
  });
});
