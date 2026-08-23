import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { ModuleAccessModule } from '../module-access/module-access.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApprovalsModule } from '../approvals/approvals.module';

/**
 * `PrismaService` and `NodeService` come from their `@Global` modules; the three
 * imports below supply the read-only services the header aggregates.
 */
@Module({
  imports: [ModuleAccessModule, NotificationsModule, ApprovalsModule],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
