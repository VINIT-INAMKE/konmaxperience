import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async findAll() {
    // Any authenticated user can list roles -- no special permission needed
    return this.rolesService.findAll();
  }

  @Patch(':id/permissions')
  @RequiresPermission(Permission.MANAGE_RBAC)
  async updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(id, dto.permissions);
  }
}
