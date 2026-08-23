import { Controller, Get, Req } from '@nestjs/common';
import express from 'express';
import { MeService, HeaderContext } from './me.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly prisma: PrismaService,
  ) {}

  /** SPEC §6.1 — the whole persistent header in one round trip. No extra permission. */
  @Get('header')
  async header(@Req() req: express.Request): Promise<HeaderContext> {
    const user = (req as any).user;
    const permissions = await getPermissionsForRole(user.roleCode, this.prisma);
    return this.me.header({
      id: user.id,
      roleCode: user.roleCode,
      permissions,
    });
  }
}
