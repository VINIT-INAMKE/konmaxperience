import { Module } from '@nestjs/common';
import { ReadinessModule } from '../readiness/readiness.module';
import { MissionBridgeController } from './mission-bridge.controller';
import { MissionBridgeListener } from './mission-bridge.listener';
import { MissionBridgeService } from './mission-bridge.service';

/**
 * SPEC §4.2. `ReadinessModule` is imported here because Task 12 consumes
 * `ReadinessDerivationService` from it to recompute a derived meter after a
 * signal lands; nothing in this task uses it yet. The dependency is
 * one-directional — `ReadinessModule` never imports the bridge.
 */
@Module({
  imports: [ReadinessModule],
  controllers: [MissionBridgeController],
  providers: [MissionBridgeService, MissionBridgeListener],
  exports: [MissionBridgeService],
})
export class MissionBridgeModule {}
