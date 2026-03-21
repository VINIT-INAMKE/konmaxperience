import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  async findAll() {
    return this.channelsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.channelsService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  async create(@Body() dto: CreateChannelDto) {
    return this.channelsService.create(dto);
  }

  @Patch(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.update(id, dto);
  }
}
