import { Injectable, NotFoundException } from '@nestjs/common';
import { Node } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_NODE_ID } from './node.constants';

/**
 * Reads the node this deployment operates. v2.0 runs exactly one node, so the row
 * is cached for the process lifetime and refreshed on update.
 */
@Injectable()
export class NodeService {
  private cached: Node | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<Node> {
    if (this.cached) return this.cached;
    const node =
      (await this.prisma.node.findUnique({ where: { id: DEFAULT_NODE_ID } })) ??
      (await this.prisma.node.findFirst({ orderBy: { created_at: 'asc' } }));
    if (!node) {
      throw new NotFoundException(
        'No Node row exists — run "npm run seed:reference" before starting the API',
      );
    }
    this.cached = node;
    return node;
  }

  async currentId(): Promise<string> {
    return (await this.current()).id;
  }

  async timezone(): Promise<string> {
    return (await this.current()).timezone;
  }

  async update(data: {
    name?: string;
    timezone?: string;
    currency?: string;
  }): Promise<Node> {
    const node = await this.current();
    this.cached = await this.prisma.node.update({
      where: { id: node.id },
      data,
    });
    return this.cached;
  }
}
