import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequiresPermission(Permission.MANAGE_SYSTEM)
  async list(
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.auditService.list(
      entityType,
      entityId,
      Number(limit) || 50,
      cursor,
    );
  }
}
