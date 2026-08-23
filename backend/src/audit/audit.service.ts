import { Injectable } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Tx } from '../common/types/transaction';
import { DEFAULT_NODE_ID } from '../node/node.constants';

export interface AuditInput {
  entity_type: string;
  entity_id: string;
  /** Dot-namespaced verb, e.g. "task.status_changed", "order.status_changed". */
  action: string;
  actor_type: ActorType;
  actor_id?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  node_id?: string;
}

/** The `{ actor_type, actor_id }` pair spread into an {@link AuditInput}. */
export interface AuditActor {
  actor_type: ActorType;
  actor_id: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one AuditEvent inside the caller's transaction (SPEC §3: "every mutating
   * write in a transaction also writes AuditEvent"). `tx` MUST be the transaction
   * client so the audit row rolls back with the change it describes.
   */
  async record(tx: Tx, input: AuditInput): Promise<void> {
    await tx.auditEvent.create({
      data: {
        node_id: input.node_id ?? DEFAULT_NODE_ID,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        actor_type: input.actor_type,
        actor_id: input.actor_id ?? null,
        before: input.before ?? Prisma.JsonNull,
        after: input.after ?? Prisma.JsonNull,
      },
    });
  }

  /** Actor tuple for a staff-initiated change; falls back to a system actor. */
  static user(userId: string | null | undefined): AuditActor {
    return userId
      ? { actor_type: ActorType.user, actor_id: userId }
      : { actor_type: ActorType.system, actor_id: null };
  }

  /** Actor tuple for a storefront-initiated change. */
  static customer(customerId: string): AuditActor {
    return { actor_type: ActorType.customer, actor_id: customerId };
  }

  async list(
    entityType?: string,
    entityId?: string,
    limit = 50,
    cursor?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    return this.prisma.auditEvent.findMany({
      where: {
        ...(entityType ? { entity_type: entityType } : {}),
        ...(entityId ? { entity_id: entityId } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }
}
