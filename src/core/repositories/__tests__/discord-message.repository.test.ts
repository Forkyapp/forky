/**
 * Discord Message Repository Tests
 */

import fs from 'fs/promises';
import path from 'path';
import { DiscordMessageRepository } from '../discord-message.repository';
import type { ProcessedMessage } from '@/types/discord';

describe('DiscordMessageRepository', () => {
  const testDir = path.join(__dirname, 'test-data');
  const testFile = path.join(testDir, 'test-discord-messages.json');
  let repository: DiscordMessageRepository;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Initialize repository
    repository = new DiscordMessageRepository(testFile);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore errors
    }
  });

  describe('init', () => {
    it('should initialize with empty array when file does not exist', async () => {
      await repository.init();
      const messages = await repository.getAll();
      expect(messages).toEqual([]);
    });

    it('should load existing messages from file', async () => {
      const testMessages: ProcessedMessage[] = [
        {
          messageId: '123',
          channelId: '456',
          processedAt: new Date('2025-11-15T10:00:00Z'),
          keywords: ['bug'],
        },
      ];

      await fs.writeFile(testFile, JSON.stringify(testMessages, null, 2));

      await repository.init();
      const messages = await repository.getAll();
      expect(messages).toHaveLength(1);
      expect(messages[0].messageId).toBe('123');
    });
  });

  describe('add', () => {
    it('should add a new message', async () => {
      await repository.init();

      const message: ProcessedMessage = {
        messageId: '123',
        channelId: '456',
        processedAt: new Date('2025-11-15T10:00:00Z'),
        keywords: ['bug', 'error'],
      };

      await repository.add(message);

      const has = await repository.has('123');
      expect(has).toBe(true);

      const all = await repository.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].messageId).toBe('123');
      expect(all[0].keywords).toEqual(['bug', 'error']);
    });

    it('should not add duplicate messages', async () => {
      await repository.init();

      const message: ProcessedMessage = {
        messageId: '123',
        channelId: '456',
        processedAt: new Date('2025-11-15T10:00:00Z'),
        keywords: ['bug'],
      };

      await repository.add(message);
      await repository.add(message); // Add same message again

      const all = await repository.getAll();
      expect(all).toHaveLength(1);
    });
  });

  describe('has', () => {
    it('should return true for existing message', async () => {
      await repository.init();

      const message: ProcessedMessage = {
        messageId: '123',
        channelId: '456',
        processedAt: new Date('2025-11-15T10:00:00Z'),
        keywords: ['bug'],
      };

      await repository.add(message);

      const has = await repository.has('123');
      expect(has).toBe(true);
    });

    it('should return false for non-existing message', async () => {
      await repository.init();

      const has = await repository.has('999');
      expect(has).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all messages', async () => {
      await repository.init();

      const message: ProcessedMessage = {
        messageId: '123',
        channelId: '456',
        processedAt: new Date('2025-11-15T10:00:00Z'),
        keywords: ['bug'],
      };

      await repository.add(message);

      let all = await repository.getAll();
      expect(all).toHaveLength(1);

      await repository.clear();

      all = await repository.getAll();
      expect(all).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should remove old messages', async () => {
      await repository.init();

      const oldMessage: ProcessedMessage = {
        messageId: '123',
        channelId: '456',
        processedAt: new Date('2024-01-01T10:00:00Z'), // Old message
        keywords: ['bug'],
      };

      const newMessage: ProcessedMessage = {
        messageId: '456',
        channelId: '456',
        processedAt: new Date('2025-11-15T10:00:00Z'), // Recent message
        keywords: ['issue'],
      };

      await repository.add(oldMessage);
      await repository.add(newMessage);

      let all = await repository.getAll();
      expect(all).toHaveLength(2);

      // Clean up messages older than 30 days
      await repository.cleanup(30);

      all = await repository.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].messageId).toBe('456'); // Only new message remains
    });

    it('should keep all messages if none are old enough', async () => {
      await repository.init();

      const message: ProcessedMessage = {
        messageId: '123',
        channelId: '456',
        processedAt: new Date('2025-11-15T10:00:00Z'),
        keywords: ['bug'],
      };

      await repository.add(message);

      await repository.cleanup(30);

      const all = await repository.getAll();
      expect(all).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('should return all messages', async () => {
      await repository.init();

      const messages: ProcessedMessage[] = [
        {
          messageId: '123',
          channelId: '456',
          processedAt: new Date('2025-11-15T10:00:00Z'),
          keywords: ['bug'],
        },
        {
          messageId: '456',
          channelId: '789',
          processedAt: new Date('2025-11-15T11:00:00Z'),
          keywords: ['error', 'crash'],
        },
      ];

      for (const msg of messages) {
        await repository.add(msg);
      }

      const all = await repository.getAll();
      expect(all).toHaveLength(2);
    });

    it('should return copy of messages array', async () => {
      await repository.init();

      const message: ProcessedMessage = {
        messageId: '123',
        channelId: '456',
        processedAt: new Date('2025-11-15T10:00:00Z'),
        keywords: ['bug'],
      };

      await repository.add(message);

      const all1 = await repository.getAll();
      const all2 = await repository.getAll();

      // Should be different array instances
      expect(all1).not.toBe(all2);
      // But with same data
      expect(all1).toEqual(all2);
    });
  });
});
