import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import express from 'express';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('asset_type') assetType?: string,
  ) {
    return this.assetsService.findAll(status, assetType);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateAssetDto, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.assetsService.create(dto, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const isAdmin = user.roleCode === 'FOUNDER_ADMIN';
    return this.assetsService.update(id, dto, user.id, isAdmin);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: express.Request,
  ) {
    const user = (req as any).user;
    const isAdmin = user.roleCode === 'FOUNDER_ADMIN';
    return this.assetsService.remove(id, user.id, isAdmin);
  }
}
