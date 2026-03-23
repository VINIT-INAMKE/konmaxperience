import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from './pusher.service';
import { ChatEvent } from './types/chat.types';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: Record<string, any>;
  let pusherService: { trigger: jest.Mock };

  beforeEach(async () => {
    prisma = {
      conversation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationParticipant: {
        findFirst: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    pusherService = {
      trigger: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: PusherService, useValue: pusherService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('checkParticipantAccess', () => {
    it('should return true when user is a participant', async () => {
      prisma.conversationParticipant.findFirst.mockResolvedValue({
        id: 'cp1',
        conversation_id: 'conv1',
        user_id: 'user1',
      });

      const result = await service.checkParticipantAccess('conv1', 'user1');
      expect(result).toBe(true);
    });

    it('should return false when user is not a participant', async () => {
      prisma.conversationParticipant.findFirst.mockResolvedValue(null);

      const result = await service.checkParticipantAccess('conv1', 'user2');
      expect(result).toBe(false);
    });
  });

  describe('createConversation', () => {
    it('should return existing direct conversation if duplicate', async () => {
      const existingConv = {
        id: 'conv1',
        type: 'direct',
        participants: [
          { user: { id: 'user1', name: 'A', email: 'a@test.com' } },
          { user: { id: 'user2', name: 'B', email: 'b@test.com' } },
        ],
      };

      prisma.conversation.findFirst.mockResolvedValue(existingConv);

      const result = await service.createConversation(
        { type: 'direct', participant_ids: ['user2'] },
        'user1',
      );

      expect(result).toEqual(existingConv);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('should create new direct conversation when none exists', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      const newConv = {
        id: 'conv-new',
        type: 'direct',
        name: null,
        created_by: 'user1',
        participants: [
          { user: { id: 'user1', name: 'A', email: 'a@test.com' } },
          { user: { id: 'user2', name: 'B', email: 'b@test.com' } },
        ],
      };
      prisma.conversation.create.mockResolvedValue(newConv);

      const result = await service.createConversation(
        { type: 'direct', participant_ids: ['user2'] },
        'user1',
      );

      expect(result.type).toBe('direct');
      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'direct',
            created_by: 'user1',
          }),
        }),
      );
    });

    it('should create group conversation with all participants + creator', async () => {
      const groupConv = {
        id: 'conv-group',
        type: 'group',
        name: 'Team Chat',
        created_by: 'admin1',
        participants: [
          { user: { id: 'admin1', name: 'Admin', email: 'admin@test.com' } },
          { user: { id: 'user2', name: 'B', email: 'b@test.com' } },
          { user: { id: 'user3', name: 'C', email: 'c@test.com' } },
        ],
      };
      prisma.conversation.create.mockResolvedValue(groupConv);

      const result = await service.createConversation(
        { type: 'group', name: 'Team Chat', participant_ids: ['user2', 'user3'] },
        'admin1',
      );

      expect(result.type).toBe('group');
      expect(result.name).toBe('Team Chat');
      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'group',
            name: 'Team Chat',
            created_by: 'admin1',
          }),
        }),
      );
    });

    it('should throw BadRequestException for group without name', async () => {
      await expect(
        service.createConversation(
          { type: 'group', participant_ids: ['user2'] },
          'admin1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getConversations', () => {
    it('should return conversations the user participates in', async () => {
      const conversations = [
        { id: 'conv1', type: 'direct', participants: [], messages: [] },
      ];
      prisma.conversation.findMany.mockResolvedValue(conversations);

      const result = await service.getConversations('user1');
      expect(result).toEqual(conversations);
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { participants: { some: { user_id: 'user1' } } },
        }),
      );
    });
  });

  describe('createMessage', () => {
    it('should create message and trigger Pusher event', async () => {
      const message = {
        id: 'msg1',
        conversation_id: 'conv1',
        sender_id: 'user1',
        sender: { id: 'user1', name: 'Alice' },
        content: 'Hello',
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        created_at: new Date('2026-03-23T12:00:00Z'),
      };
      prisma.message.create.mockResolvedValue(message);
      prisma.conversation.update.mockResolvedValue({});

      const result = await service.createMessage(
        'conv1',
        { content: 'Hello' },
        'user1',
      );

      expect(result).toEqual(message);
      expect(pusherService.trigger).toHaveBeenCalledWith(
        'private-chat-conv1',
        ChatEvent.NEW_MESSAGE,
        expect.objectContaining({
          id: 'msg1',
          sender_id: 'user1',
          sender_name: 'Alice',
          content: 'Hello',
        }),
      );
    });
  });

  describe('markRead', () => {
    it('should update last_read_at and trigger Pusher event', async () => {
      prisma.conversationParticipant.updateMany.mockResolvedValue({ count: 1 });

      await service.markRead('conv1', 'user1');

      expect(prisma.conversationParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversation_id: 'conv1', user_id: 'user1' },
        }),
      );
      expect(pusherService.trigger).toHaveBeenCalledWith(
        'private-chat-conv1',
        ChatEvent.MESSAGE_READ,
        expect.objectContaining({
          userId: 'user1',
        }),
      );
    });
  });

  describe('getConversation', () => {
    it('should throw NotFoundException if conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.getConversation('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessages', () => {
    it('should return messages in chronological order with cursor', async () => {
      const messages = [
        { id: 'msg3', created_at: new Date('2026-03-23T12:02:00Z'), sender: { id: 'u1', name: 'A' } },
        { id: 'msg2', created_at: new Date('2026-03-23T12:01:00Z'), sender: { id: 'u2', name: 'B' } },
        { id: 'msg1', created_at: new Date('2026-03-23T12:00:00Z'), sender: { id: 'u1', name: 'A' } },
      ];
      prisma.message.findMany.mockResolvedValue(messages);

      const result = await service.getMessages('conv1', undefined, 30);

      // Messages should be reversed (chronological order)
      expect(result.messages[0].id).toBe('msg1');
      expect(result.messages[2].id).toBe('msg3');
    });
  });
});
