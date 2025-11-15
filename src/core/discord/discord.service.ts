/**
 * Discord Service
 * Handles Discord message polling, keyword detection, and analysis
 */

import config from '@/shared/config';
import { DiscordClient } from '@/infrastructure/api/discord.client';
import { DiscordMessageRepository } from '@/core/repositories/discord-message.repository';
import type {
  DiscordMessage,
  AnalyzedMessage,
  KeywordMatch,
  MessagePriority,
  ProcessedMessage,
  DiscordServiceEvents,
} from '@/types/discord';
import { logger } from '@/shared/utils/logger.util';
import { forky } from '@/shared/ui';

export class DiscordService {
  private client: DiscordClient | null = null;
  private messageRepository: DiscordMessageRepository;
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private events: DiscordServiceEvents = {};

  constructor() {
    this.messageRepository = new DiscordMessageRepository(
      config.files.discordMessagesFile
    );
  }

  /**
   * Initialize the Discord service
   */
  async init(): Promise<void> {
    if (!config.discord.enabled) {
      logger.info('Discord integration is disabled');
      return;
    }

    if (!config.discord.token || !config.discord.guildId) {
      logger.warn('Discord token or guild ID not configured');
      return;
    }

    if (config.discord.channelIds.length === 0) {
      logger.warn('No Discord channels configured for monitoring');
      return;
    }

    // Initialize message repository
    await this.messageRepository.init();

    // Initialize Discord client
    this.client = new DiscordClient({
      token: config.discord.token,
      guildId: config.discord.guildId,
    });

    // Connect to Discord
    await this.client.connect();

    logger.info('Discord service initialized', {
      guildId: config.discord.guildId,
      channels: config.discord.channelIds.length,
      keywords: config.discord.keywords.length,
    });

    if (this.events.onReady) {
      this.events.onReady();
    }
  }

  /**
   * Start polling for messages
   */
  startPolling(): void {
    if (!this.client || !config.discord.enabled) {
      return;
    }

    if (this.isPolling) {
      logger.warn('Discord polling already started');
      return;
    }

    this.isPolling = true;
    logger.info('Starting Discord message polling', {
      intervalMs: config.discord.pollIntervalMs,
    });

    console.log(timmy.info('🔵 Discord bot monitoring started'));

    // Initial poll
    this.pollMessages().catch((error) => {
      logger.error('Error during initial Discord poll', error);
      if (this.events.onError) {
        this.events.onError(error);
      }
    });

    // Set up periodic polling
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollMessages();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Error during Discord polling', err);
        if (this.events.onError) {
          this.events.onError(err);
        }
      }
    }, config.discord.pollIntervalMs);
  }

  /**
   * Stop polling for messages
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isPolling = false;
    logger.info('Discord message polling stopped');
  }

  /**
   * Poll messages from all configured channels
   */
  private async pollMessages(): Promise<void> {
    if (!this.client) {
      return;
    }

    logger.info('Polling Discord messages', {
      channels: config.discord.channelIds.length,
    });

    const messageMap = await this.client.fetchMessagesFromChannels({
      channelIds: config.discord.channelIds,
      limit: 50, // Fetch last 50 messages per channel
    });

    let totalMessages = 0;
    let newMessages = 0;
    let matchedMessages = 0;

    for (const [channelId, messages] of messageMap.entries()) {
      totalMessages += messages.length;

      for (const message of messages) {
        // Skip bot messages
        if (message.author.bot) {
          continue;
        }

        // Check if already processed
        const isProcessed = await this.messageRepository.has(message.id);
        if (isProcessed) {
          continue;
        }

        newMessages++;

        // Analyze message for keywords
        const analyzed = this.analyzeMessage(message);

        if (analyzed.matches.length > 0) {
          matchedMessages++;

          logger.info('Keyword match found in Discord message', {
            messageId: message.id,
            channelId: message.channelId,
            author: message.author.username,
            keywords: analyzed.matches.map((m) => m.keyword),
            priority: analyzed.priority,
          });

          console.log(
            timmy.success(
              `🔍 Found message with keywords: ${analyzed.matches.map((m) => m.keyword).join(', ')}`
            )
          );

          // Emit event
          if (this.events.onMessageDetected) {
            await this.events.onMessageDetected(analyzed);
          }
        }

        // Mark message as processed
        await this.markAsProcessed(message, analyzed.matches);
      }
    }

    logger.info('Discord poll completed', {
      totalMessages,
      newMessages,
      matchedMessages,
    });

    // Clean up old processed messages (older than 30 days)
    await this.messageRepository.cleanup(30);
  }

  /**
   * Analyze message for keyword matches
   */
  private analyzeMessage(message: DiscordMessage): AnalyzedMessage {
    const content = message.content.toLowerCase();
    const matches: KeywordMatch[] = [];

    for (const keyword of config.discord.keywords) {
      const position = content.indexOf(keyword);
      if (position !== -1) {
        // Extract context around keyword (50 chars before and after)
        const start = Math.max(0, position - 50);
        const end = Math.min(content.length, position + keyword.length + 50);
        const context = message.content.substring(start, end);

        matches.push({
          keyword,
          context,
          position,
        });
      }
    }

    const priority = this.determinePriority(matches);
    const extractedContext = this.extractContext(message, matches);

    return {
      message,
      matches,
      priority,
      extractedContext,
    };
  }

  /**
   * Determine message priority based on keywords
   */
  private determinePriority(matches: KeywordMatch[]): MessagePriority {
    const keywords = matches.map((m) => m.keyword);

    // High priority keywords
    const highPriority = ['crash', 'error', 'critical', 'urgent', 'broken'];
    if (keywords.some((kw) => highPriority.includes(kw))) {
      return 'HIGH' as MessagePriority;
    }

    // Medium priority keywords
    const mediumPriority = ['bug', 'issue', 'problem', 'fix'];
    if (keywords.some((kw) => mediumPriority.includes(kw))) {
      return 'MEDIUM' as MessagePriority;
    }

    // Low priority (feature requests, suggestions)
    return 'LOW' as MessagePriority;
  }

  /**
   * Extract relevant context from message
   */
  private extractContext(
    message: DiscordMessage,
    matches: KeywordMatch[]
  ): string {
    if (matches.length === 0) {
      return message.content;
    }

    // Return the full message content for now
    // In the future, this could be enhanced with AI analysis
    return message.content;
  }

  /**
   * Mark message as processed
   */
  private async markAsProcessed(
    message: DiscordMessage,
    matches: KeywordMatch[]
  ): Promise<void> {
    const processed: ProcessedMessage = {
      messageId: message.id,
      channelId: message.channelId,
      processedAt: new Date(),
      keywords: matches.map((m) => m.keyword),
    };

    await this.messageRepository.add(processed);
  }

  /**
   * Register event handlers
   */
  on(events: DiscordServiceEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Manually fetch and analyze messages (for testing)
   */
  async fetchAndAnalyze(): Promise<AnalyzedMessage[]> {
    if (!this.client) {
      throw new Error('Discord client not initialized');
    }

    const messageMap = await this.client.fetchMessagesFromChannels({
      channelIds: config.discord.channelIds,
      limit: 50,
    });

    const analyzed: AnalyzedMessage[] = [];

    for (const messages of messageMap.values()) {
      for (const message of messages) {
        if (!message.author.bot) {
          const analysis = this.analyzeMessage(message);
          if (analysis.matches.length > 0) {
            analyzed.push(analysis);
          }
        }
      }
    }

    return analyzed;
  }

  /**
   * Get statistics about processed messages
   */
  async getStats(): Promise<{
    totalProcessed: number;
    processedToday: number;
    matchedToday: number;
  }> {
    const all = await this.messageRepository.getAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const processedToday = all.filter(
      (m) => new Date(m.processedAt) >= today
    ).length;

    const matchedToday = all.filter(
      (m) => new Date(m.processedAt) >= today && m.keywords.length > 0
    ).length;

    return {
      totalProcessed: all.length,
      processedToday,
      matchedToday,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    this.stopPolling();

    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    logger.info('Discord service shut down');
  }
}

// Export singleton instance
export const discordService = new DiscordService();
