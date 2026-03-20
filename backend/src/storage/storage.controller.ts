import {
  Controller,
  Post,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import express from 'express';
import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { RequiresPermission } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';
import { PresignDto } from './dto/presign.dto';

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('presign')
  @RequiresPermission(Permission.UPLOAD_EVIDENCE)
  async presign(@Body() dto: PresignDto, @Req() req: express.Request) {
    const user = (req as any).user;

    // Validate content type and file size
    this.storageService.validatePresignRequest(dto.contentType, dto.fileSize);

    // Verify user is the task owner or has admin permission
    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
      select: { id: true, owner_user_id: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${dto.taskId} not found`);
    }

    const isOwner = task.owner_user_id === user.id;
    if (!isOwner) {
      const perms = await getPermissionsForRole(user.roleCode, this.prisma);
      if (!perms.includes(Permission.UPDATE_ANY_TASK)) {
        throw new ForbiddenException(
          'You can only upload evidence to your own tasks',
        );
      }
    }

    // Build key and generate presigned URL
    const key = this.storageService.buildStorageKey(dto.taskId, dto.filename);
    const presignedUrl = await this.storageService.generatePresignedPutUrl(
      key,
      dto.contentType,
    );
    const publicUrl = this.storageService.getPublicUrl(key);

    return { presignedUrl, key, publicUrl };
  }
}
