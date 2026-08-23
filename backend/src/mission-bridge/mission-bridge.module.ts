import { Module } from '@nestjs/common';
import { ReadinessModule } from '../readiness/readiness.module';
import { MissionBridgeController } from './mission-bridge.controller';
import { MissionBridgeListener } from './mission-bridge.listener';
import { MissionBridgeService } from './mission-bridge.service';

/**
 * SPEC §4.2. `ReadinessModule` is imported for `ReadinessDerivationService`,
 * which `MissionBridgeService` calls after a signal lands to recompute the
 * derived meter and its hybrids. The dependency is one-directional —
 * `ReadinessModule` never imports the bridge.
 *
 * `ApprovalPolicyService` and `AuditService` — both needed by the improvement-
 * task spawn — come from `@Global()` modules (`ApprovalPolicyModule`,
 * `AuditModule`) and so need no import here.
 */
@Module({
  imports: [ReadinessModule],
  controllers: [MissionBridgeController],
  providers: [MissionBridgeService, MissionBridgeListener],
  exports: [MissionBridgeService],
})
export class MissionBridgeModule {}
