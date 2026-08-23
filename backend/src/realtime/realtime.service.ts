import { ForbiddenException, Injectable } from '@nestjs/common';
import type Pusher from 'pusher';
import { PusherService } from '../chat/pusher.service';
import { PrismaService } from '../prisma/prisma.service';
import { getPermissionsForRole } from '../permissions/permissions.cache';
import {
  REALTIME_CHANNELS,
  USER_CHANNEL_PREFIX,
  StaticChannel,
} from './realtime.channels';

@Injectable()
export class RealtimeService {
  constructor(
    private readonly pusher: PusherService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generalised Pusher channel auth. `POST /chat/auth` keeps its own hard-wired
   * `private-chat-*` handler; every other private channel is authorised here.
   */
  async authorize(
    socketId: string,
    channel: string,
    actor: { id: string; roleCode: string },
  ): Promise<Pusher.AuthResponse> {
    if (channel.startsWith(USER_CHANNEL_PREFIX)) {
      // A user may only ever subscribe to their own channel.
      if (channel !== `${USER_CHANNEL_PREFIX}${actor.id}`) {
        throw new ForbiddenException('Not your channel');
      }
      return this.pusher.authorizeChannel(socketId, channel);
    }

    const rule = REALTIME_CHANNELS[channel as StaticChannel];
    if (!rule) throw new ForbiddenException('Unknown channel');

    const perms = await getPermissionsForRole(actor.roleCode, this.prisma);
    if (!perms.includes(rule.permission)) {
      throw new ForbiddenException('Missing permission');
    }

    // ModuleAccess is the visibility layer (SPEC §6.3) — a role without the module
    // never sees the screen, so it must not hold a socket for it either.
    const module = await this.prisma.moduleAccess.findUnique({
      where: { module_key: rule.moduleKey },
      select: { enabled: true, role_codes: true },
    });
    if (!module?.enabled || !module.role_codes.includes(actor.roleCode)) {
      throw new ForbiddenException('Module not visible to this role');
    }

    return this.pusher.authorizeChannel(socketId, channel);
  }

  /** Failure-isolated: a realtime push must never fail the business write. */
  async emit(channel: string, event: string, data: unknown): Promise<void> {
    try {
      await this.pusher.trigger(channel, event, data);
    } catch {
      /* PusherService already logs; a dropped push degrades to the 30 s poll. */
    }
  }
}
