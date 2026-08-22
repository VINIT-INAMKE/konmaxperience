import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuleAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** All modules, ordered for the navigation spine (SPEC §6.2). */
  async findAll() {
    return this.prisma.moduleAccess.findMany({
      orderBy: [{ sort_order: 'asc' }, { module_key: 'asc' }],
    });
  }

  /** Module keys this role may see — the data behind SPEC §6.3. */
  async forRole(roleCode: string): Promise<string[]> {
    const rows = await this.prisma.moduleAccess.findMany({
      where: { enabled: true, role_codes: { has: roleCode } },
      orderBy: [{ sort_order: 'asc' }],
      select: { module_key: true },
    });
    return rows.map((r) => r.module_key);
  }

  async update(
    moduleKey: string,
    data: { role_codes?: string[]; enabled?: boolean; sort_order?: number },
  ) {
    const existing = await this.prisma.moduleAccess.findUnique({
      where: { module_key: moduleKey },
    });
    if (!existing) {
      throw new NotFoundException(`Module "${moduleKey}" not found`);
    }
    return this.prisma.moduleAccess.update({
      where: { module_key: moduleKey },
      data,
    });
  }
}
