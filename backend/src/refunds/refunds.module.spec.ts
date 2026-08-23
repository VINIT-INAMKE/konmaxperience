import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RefundsModule } from './refunds.module';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockPrisma } from '../test-utils/mock-providers';

/**
 * The unit suite wires `RefundsService` from an explicit provider list, which
 * proves nothing about `RefundsModule.imports`. This compiles the *real* graph
 * so a missing `RazorpayModule`/`LoyaltyModule` import fails here rather than at
 * boot, after a merge. `PrismaModule` and `AuditModule` stand in for the
 * `@Global()` modules `AppModule` supplies.
 */
describe('RefundsModule', () => {
  it('resolves RefundsService from the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuditModule,
        RefundsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma())
      .compile();

    expect(moduleRef.get(RefundsService)).toBeInstanceOf(RefundsService);
  });
});
