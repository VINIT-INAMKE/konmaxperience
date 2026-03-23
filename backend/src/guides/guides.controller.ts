import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { GuidesService } from './guides.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

@Controller('guide')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  // ==================== SEARCH ====================

  @Get('search')
  search(@Query('q') q: string, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.guidesService.searchPages(q, user.roleCode);
  }

  // ==================== SECTIONS (Read) ====================

  @Get('sections')
  findAllSections(@Req() req: express.Request) {
    const user = (req as any).user;
    return this.guidesService.findSections(user.roleCode);
  }

  @Get('sections/:id')
  findOneSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.guidesService.findSection(id, user.roleCode);
  }

  // ==================== SECTIONS (Write) ====================

  @Post('sections')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  createSection(@Body() dto: CreateSectionDto) {
    return this.guidesService.createSection(dto);
  }

  @Patch('sections/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.guidesService.updateSection(id, dto);
  }

  @Delete('sections/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  removeSection(@Param('id', ParseUUIDPipe) id: string) {
    return this.guidesService.removeSection(id);
  }

  // ==================== PAGES (Read) ====================

  @Get('pages/:id')
  findOnePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    return this.guidesService.findPage(id, user.roleCode);
  }

  // ==================== PAGES (Write) ====================

  @Post('pages')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  createPage(@Body() dto: CreatePageDto) {
    return this.guidesService.createPage(dto);
  }

  @Patch('pages/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.guidesService.updatePage(id, dto);
  }

  @Delete('pages/:id')
  @RequiresPermission(Permission.MANAGE_GUIDE)
  removePage(@Param('id', ParseUUIDPipe) id: string) {
    return this.guidesService.removePage(id);
  }
}
