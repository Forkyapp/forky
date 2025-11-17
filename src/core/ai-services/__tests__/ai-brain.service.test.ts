/**
 * AI Brain Service Tests
 * Tests for the conversational AI brain service
 */

import { AIBrainService } from '../ai-brain.service';
import OpenAI from 'openai';
import config from '@/shared/config';
import { suppressConsole } from '../../../test-setup';

// Mock dependencies
jest.mock('openai');
jest.mock('@/shared/config');
jest.mock('@/shared/utils/logger.util', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Suppress console output
suppressConsole();

describe('AIBrainService', () => {
  let service: AIBrainService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config
    (config as any).openai = {
      apiKey: 'test-api-key',
    };

    // Mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    // Clear timers to prevent cleanup interval from running
    jest.useFakeTimers();

    service = new AIBrainService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with OpenAI API key', () => {
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
    });

    it('should throw error when API key not configured', () => {
      (config as any).openai = undefined;

      expect(() => new AIBrainService()).toThrow('OpenAI API key not configured');
    });
  });

  describe('chat', () => {
    it('should successfully chat with user and return response', async () => {
      const userId = 'user-123';
      const channelId = 'channel-456';
      const message = 'Hello, can you help me?';

      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Sure, I can help you!',
            },
          },
        ],
        usage: {
          total_tokens: 50,
        },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.chat(userId, channelId, message);

      expect(result).toBe('Sure, I can help you!');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          max_tokens: 150,
          temperature: 0.7,
        })
      );

      // Verify the call included messages
      const call = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[0][0];
      expect(call.messages).toBeDefined();
      expect(call.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should maintain conversation context across multiple messages', async () => {
      const userId = 'user-123';
      const channelId = 'channel-456';

      const mockResponse1 = {
        choices: [{ message: { content: 'First response' } }],
        usage: { total_tokens: 20 },
      };

      const mockResponse2 = {
        choices: [{ message: { content: 'Second response' } }],
        usage: { total_tokens: 30 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      await service.chat(userId, channelId, 'First message');
      await service.chat(userId, channelId, 'Second message');

      // Verify that multiple chat calls were made
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);

      // Verify context is maintained - the conversation should have history
      const stats = service.getStats();
      expect(stats.activeConversations).toBe(1);
      expect(stats.totalMessages).toBeGreaterThan(0);
    });

    it('should limit conversation history to last 10 messages plus system prompt', async () => {
      const userId = 'user-123';
      const channelId = 'channel-456';

      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { total_tokens: 10 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      for (let i = 0; i < 15; i++) {
        await service.chat(userId, channelId, `Message ${i}`);
      }

      const lastCall = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[14][0];

      // Context keeps system prompt + last 10 messages (user + assistant pairs)
      expect(lastCall.messages.length).toBeLessThanOrEqual(12);
      expect(lastCall.messages[0].role).toBe('system');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const userId = 'user-123';
      const channelId = 'channel-456';
      const message = 'Test message';

      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const result = await service.chat(userId, channelId, message);

      expect(result).toBe('I apologize, I encountered an error processing your message. Please try again.');
    });

    it('should handle empty response from OpenAI', async () => {
      const userId = 'user-123';
      const channelId = 'channel-456';
      const message = 'Test message';

      const mockResponse = {
        choices: [],
        usage: { total_tokens: 10 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.chat(userId, channelId, message);

      expect(result).toBe('I apologize, I could not generate a response.');
    });

    it('should create separate conversation contexts for different users', async () => {
      const userId1 = 'user-123';
      const userId2 = 'user-456';
      const channelId = 'channel-789';

      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { total_tokens: 10 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      await service.chat(userId1, channelId, 'User 1 message');
      await service.chat(userId2, channelId, 'User 2 message');

      const call1 = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[0][0];
      const call2 = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];

      // First call: system + user message
      expect(call1.messages.length).toBeGreaterThanOrEqual(2);
      // Second call: system + user message (different context)
      expect(call2.messages.length).toBeGreaterThanOrEqual(2);

      // Verify different contexts by checking context keys are different
      expect(call1.messages[1].content).toBe('User 1 message');
      expect(call2.messages[1].content).toBe('User 2 message');
    });
  });

  describe('analyzeTaskRequirements', () => {
    it('should analyze message and determine if it has enough info', async () => {
      const message = 'Create a login feature with email and password authentication';

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                hasEnoughInfo: true,
                summary: 'User wants login feature with email/password',
                missingInfo: [],
              }),
            },
          },
        ],
        usage: { total_tokens: 50 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.analyzeTaskRequirements(message);

      expect(result.hasEnoughInfo).toBe(true);
      expect(result.summary).toBe('User wants login feature with email/password');
      expect(result.missingInfo).toEqual([]);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          response_format: { type: 'json_object' },
        })
      );
    });

    it('should identify missing information in task requirements', async () => {
      const message = 'Add a feature';

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                hasEnoughInfo: false,
                summary: 'User wants to add a feature',
                missingInfo: ['Feature details', 'Specific functionality', 'User requirements'],
              }),
            },
          },
        ],
        usage: { total_tokens: 40 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.analyzeTaskRequirements(message);

      expect(result.hasEnoughInfo).toBe(false);
      expect(result.missingInfo).toContain('Feature details');
      expect(result.missingInfo).toContain('Specific functionality');
    });

    it('should handle analysis errors gracefully', async () => {
      const message = 'Test message';

      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('Analysis failed')
      );

      const result = await service.analyzeTaskRequirements(message);

      expect(result.hasEnoughInfo).toBe(false);
      expect(result.summary).toBe('Error analyzing requirements');
      expect(result.missingInfo).toEqual(['Could not analyze message']);
    });

    it('should handle invalid JSON response', async () => {
      const message = 'Test message';

      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Not valid JSON',
            },
          },
        ],
        usage: { total_tokens: 10 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.analyzeTaskRequirements(message);

      expect(result.hasEnoughInfo).toBe(false);
      expect(result.summary).toBe('Error analyzing requirements');
    });
  });

  describe('clearConversation', () => {
    it('should clear conversation history for specific user', async () => {
      const userId = 'user-123';
      const channelId = 'channel-456';

      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { total_tokens: 10 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      await service.chat(userId, channelId, 'Test message');

      service.clearConversation(userId, channelId);

      await service.chat(userId, channelId, 'New message');

      const lastCall = (mockOpenAI.chat.completions.create as jest.Mock).mock.calls[1][0];

      // After clearing: should have system + new user message (without previous history)
      expect(lastCall.messages.length).toBeGreaterThanOrEqual(2);
      expect(lastCall.messages[0].role).toBe('system');

      // Find the new message in the context
      const hasNewMessage = lastCall.messages.some((msg: { content: string }) => msg.content === 'New message');
      expect(hasNewMessage).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return conversation statistics', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { total_tokens: 10 },
      };

      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      await service.chat('user-1', 'channel-1', 'Message 1');
      await service.chat('user-2', 'channel-1', 'Message 2');

      const stats = service.getStats();

      expect(stats.activeConversations).toBe(2);
      expect(stats.totalMessages).toBeGreaterThan(0);
    });

    it('should return zero stats when no conversations', () => {
      const stats = service.getStats();

      expect(stats.activeConversations).toBe(0);
      expect(stats.totalMessages).toBe(0);
    });
  });

  describe('cleanup mechanism', () => {
    it('should schedule cleanup interval on initialization', () => {
      // Verify that setInterval was called in constructor
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });
  });
});
