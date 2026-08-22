import { Body, Controller, Get, Patch } from '@nestjs/common';
import { NodeService } from './node.service';
import { UpdateNodeDto } from './dto/update-node.dto';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('nodes')
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  @Get('current')
  async current() {
    return this.nodeService.current();
  }

  @Patch('current')
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async update(@Body() dto: UpdateNodeDto) {
    return this.nodeService.update(dto);
  }
}
