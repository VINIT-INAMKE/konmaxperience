import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from './pusher.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatEvent, MessagePayload, ReadReceiptPayload } from './types/chat.types';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pusherService: PusherService,
  ) {}

  // ==================== Participant Access ====================

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

  // ==================== Conversations ====================

  async createConversation(dto: CreateConversationDto, userId: string) {
    if (dto.type === 'direct') {
      const targetUserId = dto.participant_ids[0];

      // Check for existing direct conversation between these two users
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          type: 'direct',
          AND: [
            { participants: { some: { user_id: userId } } },
            { participants: { some: { user_id: targetUserId } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (existingConversation) {
        return existingConversation;
      }

      // Create new direct conversation
      const conversation = await this.prisma.conversation.create({
        data: {
          type: 'direct',
          name: null,
          created_by: userId,
          participants: {
            create: [
              { user_id: userId },
              { user_id: targetUserId },
            ],
          },
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      return conversation;
    }

    // Group conversation
    if (!dto.name) {
      throw new BadRequestException('Group conversations require a name');
    }

    // Ensure creator is included in participants
    const allParticipantIds = Array.from(
      new Set([userId, ...dto.participant_ids]),
    );

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'group',
        name: dto.name,
        created_by: userId,
        participants: {
          create: allParticipantIds.map((id) => ({ user_id: id })),
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return conversation;
  }

  async getConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: { some: { user_id: userId } },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async getAllConversations() {
    return this.prisma.conversation.findMany({
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async getConversation(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  // ==================== Messages ====================

  async getMessages(
    conversationId: string,
    cursor?: string,
    take: number = 30,
  ) {
    const messages = await this.prisma.message.findMany({
      where: { conversation_id: conversationId },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
      orderBy: { created_at: 'desc' },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // Reverse so messages are chronological (oldest first)
    const reversed = messages.reverse();
    const hasMore = messages.length === take;
    const nextCursor = hasMore ? messages[0]?.id : null;

    return {
      messages: reversed,
      nextCursor,
    };
  }

  async createMessage(
    conversationId: string,
    dto: CreateMessageDto,
    senderId: string,
  ) {
    // Create message in DB
    const message = await this.prisma.message.create({
      data: {
        conversation_id: conversationId,
        sender_id: senderId,
        content: dto.content || null,
        attachment_key: dto.attachment_key || null,
        attachment_url: dto.attachment_url || null,
        attachment_name: dto.attachment_name || null,
        attachment_type: dto.attachment_type || null,
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    // Update conversation.updated_at
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updated_at: new Date() },
    });

    // Trigger Pusher event AFTER database write
    const payload: MessagePayload = {
      id: message.id,
      sender_id: message.sender_id,
      sender_name: message.sender.name,
      content: message.content,
      attachment_url: message.attachment_url,
      attachment_type: message.attachment_type,
      attachment_name: message.attachment_name,
      created_at: message.created_at.toISOString(),
    };

    await this.pusherService.trigger(
      'private-chat-' + conversationId,
      ChatEvent.NEW_MESSAGE,
      payload,
    );

    return message;
  }

  // ==================== Read Receipts ====================

  async markRead(conversationId: string, userId: string) {
    const readAt = new Date();

    await this.prisma.conversationParticipant.updateMany({
      where: {
        conversation_id: conversationId,
        user_id: userId,
      },
      data: { last_read_at: readAt },
    });

    // Trigger Pusher event AFTER database write
    const payload: ReadReceiptPayload = {
      userId,
      readAt: readAt.toISOString(),
    };

    await this.pusherService.trigger(
      'private-chat-' + conversationId,
      ChatEvent.MESSAGE_READ,
      payload,
    );
  }

  // ==================== Group Member Management ====================

  async addMembers(conversationId: string, userIds: string[]) {
    await this.prisma.conversationParticipant.createMany({
      data: userIds.map((userId) => ({
        conversation_id: conversationId,
        user_id: userId,
      })),
      skipDuplicates: true,
    });
  }

  async removeMembers(conversationId: string, userIds: string[]) {
    await this.prisma.conversationParticipant.deleteMany({
      where: {
        conversation_id: conversationId,
        user_id: { in: userIds },
      },
    });
  }
}
