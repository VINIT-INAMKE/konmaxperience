import { Global, Module } from '@nestjs/common';
import { NodeService } from './node.service';
import { NodeController } from './node.controller';

@Global()
@Module({
  controllers: [NodeController],
  providers: [NodeService],
  exports: [NodeService],
})
export class NodeModule {}
