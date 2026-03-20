import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { Permission } from '../types/permissions';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTask(taskId: string) {
    return this.prisma.evidence.findMany({
      where: { task_id: taskId },
      include: {
        uploader: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${id} not found`);
    }

    return evidence;
  }

  async create(
    taskId: string,
    uploaderId: string,
    uploaderRoleCode: string,
    dto: CreateEvidenceDto,
  ) {
    // Verify the task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, owner_user_id: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Verify the uploader is the task owner or has admin permission
    const isOwner = task.owner_user_id === uploaderId;
    if (!isOwner) {
      const perms = await getPermissionsForRole(
        uploaderRoleCode,
        this.prisma,
      );
      if (!perms.includes(Permission.UPDATE_ANY_TASK)) {
        throw new ForbiddenException(
          'You can only upload evidence to your own tasks',
        );
      }
    }

    return this.prisma.evidence.create({
      data: {
        task_id: taskId,
        uploaded_by: uploaderId,
        type: dto.type,
        url: dto.url,
        notes: dto.notes,
        approval_status: 'pending',
      },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    });
  }
}
