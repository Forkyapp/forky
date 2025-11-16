/**
 * Discord to ClickUp Bridge Tests
 */

import { createTaskFromDiscordMessage } from '../discord-clickup-bridge';
import type { AnalyzedMessage, DiscordMessage } from '@/types/discord';
import { MessagePriority } from '@/types/discord';

const mockCreateTask = jest.fn();
jest.mock('@/infrastructure/api/clickup.client', () => ({
  ClickUpClient: jest.fn().mockImplementation(() => ({
    createTask: mockCreateTask,
  })),
}));

jest.mock('@/shared/config', () => ({
  __esModule: true,
  default: {
    clickup: {
      apiKey: 'test-api-key',
      listId: 'test-list-id',
      botUserId: 123456,
      workspaceId: 'test-workspace',
    },
  },
}));

describe('Discord to ClickUp Bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTaskFromDiscordMessage', () => {
    it('should create ClickUp task from Discord message with keywords - task 86evhpqe7', async () => {
      const discordMessage: DiscordMessage = {
        id: '1439612051592052736',
        channelId: '1439207226261897307',
        guildId: '1439207178048376895',
        content: '<@&1439208337433563278> create test task on clickup',
        author: {
          id: 'user123',
          username: '.kuxala',
          bot: false,
        },
        timestamp: new Date('2025-11-16T10:00:00Z'),
        mentions: ['1439208337433563278'],
        attachments: [],
      };

      const analyzedMessage: AnalyzedMessage = {
        message: discordMessage,
        matches: [
          { keyword: 'create', position: 28, context: 'create test task on clickup' },
          { keyword: 'task', position: 40, context: 'test task on clickup' },
        ],
        priority: MessagePriority.LOW,
        extractedContext: discordMessage.content,
      };

      const mockTask = {
        id: '86evhpqe7',
        name: 'create test task on clickup',
        url: 'https://app.clickup.com/t/86evhpqe7',
      };

      mockCreateTask.mockResolvedValue(mockTask);

      const result = await createTaskFromDiscordMessage(analyzedMessage);

      expect(result.success).toBe(true);
      expect(result.task?.id).toBe('86evhpqe7');
    });
  });
});
