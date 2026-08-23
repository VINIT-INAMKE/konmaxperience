import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ShipmentsModule } from './shipments.module';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrisma } from '../test-utils/mock-providers';

/**
 * The unit suite wires `ShipmentsService` from an explicit provider list, which
 * proves nothing about `ShipmentsModule.imports`. This compiles the *real* graph
 * so a missing `ChatModule`/`ShippingModule`/`SettingsModule` import fails here
 * rather than at boot, after a merge. `PrismaModule` and `AuditModule` stand in
 * for the `@Global()` modules `AppModule` supplies.
 */
describe('ShipmentsModule', () => {
  it('resolves ShipmentsService from the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuditModule,
        EventEmitterModule.forRoot(),
        ShipmentsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma())
      .compile();

    expect(moduleRef.get(ShipmentsService)).toBeInstanceOf(ShipmentsService);
  });
});
