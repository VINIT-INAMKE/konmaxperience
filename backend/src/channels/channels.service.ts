import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.channel.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
    });
    if (!channel) {
      throw new NotFoundException(`Channel with ID ${id} not found`);
    }
    return channel;
  }

  async create(dto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: {
        name: dto.name,
        channel_type: dto.channel_type,
      },
    });
  }

  async update(id: string, dto: UpdateChannelDto) {
    await this.findOne(id);
    return this.prisma.channel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.channel_type !== undefined && { channel_type: dto.channel_type }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }
}
