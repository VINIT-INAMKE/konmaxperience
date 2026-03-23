import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from './pusher.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pusherService: PusherService,
  ) {}

  async checkParticipantAccess(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const participant =
      await this.prisma.conversationParticipant.findFirst({
        where: {
          conversation_id: conversationId,
          user_id: userId,
        },
      });
    return !!participant;
  }
}
