import { Controller, Get, Query, Req } from '@nestjs/common';
import express from 'express';
import {
  SearchService,
  SearchResults,
  DEFAULT_SEARCH_LIMIT,
} from './search.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import { PrismaService } from '../prisma/prisma.service';

@Controller('search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ⌘K. Authenticated, but no extra permission — every bucket is individually
   * scoped to what the caller may already read.
   */
  @Get()
  async find(
    @Req() req: express.Request,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<SearchResults> {
    const user = (req as any).user;
    const permissions = await getPermissionsForRole(user.roleCode, this.prisma);
    const parsed = Number(limit);
    return this.search.search(
      q ?? '',
      { id: user.id, roleCode: user.roleCode, permissions },
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEARCH_LIMIT,
    );
  }
}
