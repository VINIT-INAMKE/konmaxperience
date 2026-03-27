import { Controller, Get, Patch, Param, ParseUUIDPipe } from '@nestjs/common';
import { RequiresPermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../types/permissions';
import { PickAndPackService } from './pick-and-pack.service';

@Controller('kitchen/pick-and-pack')
export class PickAndPackController {
  constructor(private readonly service: PickAndPackService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  getActiveOrders() {
    return this.service.getActiveOrders();
  }

  @Patch('items/:id/picked')
  @RequiresPermission(Permission.MANAGE_KITCHEN)
  markItemPicked(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.markItemPicked(id);
  }
}
