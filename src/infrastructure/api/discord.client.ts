/**
 * Discord API Client
 * Handles Discord bot connection and message fetching
 */

import {
  Client,
  GatewayIntentBits,
  Collection,
  Message,
  TextChannel,
  Guild,
  ChannelType as DJSChannelType,
} from 'discord.js';
import type {
  DiscordMessage,
  DiscordChannel,
  DiscordGuild,
  MessagePollOptions,
  ChannelType,
} from '@/types/discord';
import { APIError } from '@/shared/errors';
import { logger } from '@/shared/utils/logger.util';

export interface DiscordClientConfig {
  readonly token: string;
  readonly guildId: string;
  readonly onMessage?: (message: Message<boolean>) => void | Promise<void>;
}

export class DiscordClient {
  private client: Client;
  private readonly token: string;
  private readonly guildId: string;
  private isReady: boolean = false;
  private readyPromise: Promise<void>;

  constructor(config: DiscordClientConfig) {
    this.token = config.token;
    this.guildId = config.guildId;

    // Initialize Discord client with necessary intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Set up ready event
    this.readyPromise = new Promise((resolve) => {
      this.client.once('clientReady', () => {
        this.isReady = true;
        logger.debug('Discord bot connected', {
          username: this.client.user?.tag,
        });
        resolve();
      });
    });

    // Set up error handler
    this.client.on('error', (error: Error) => {
      logger.error('Discord client error', error);
    });

    // Set up message event listener for real-time responses
    if (config.onMessage) {
      this.client.on('messageCreate', async (message) => {
        if (config.onMessage) {
          try {
            await config.onMessage(message);
          } catch (error) {
            logger.error('Error in message handler', error instanceof Error ? error : new Error(String(error)));
          }
        }
      });
    }
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    try {
      await this.client.login(this.token);
      await this.readyPromise;
    } catch (error) {
      throw new APIError(
        'Failed to connect to Discord',
        'DISCORD_CONNECTION_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    await this.client.destroy();
    this.isReady = false;
  }

  /**
   * Ensure the client is ready before operations
   */
  private ensureReady(): void {
    if (!this.isReady) {
      throw new APIError(
        'Discord client not ready. Call connect() first.',
        'DISCORD_NOT_READY',
        503
      );
    }
  }

  /**
   * Get the guild (server)
   */
  private async getGuild(): Promise<Guild> {
    this.ensureReady();

    const guild = await this.client.guilds.fetch(this.guildId);
    if (!guild) {
      throw new APIError(
        `Guild not found: ${this.guildId}`,
        'DISCORD_GUILD_NOT_FOUND',
        404
      );
    }

    return guild;
  }

  /**
   * Fetch messages from a specific channel
   */
  async fetchMessages(
    channelId: string,
    options?: MessagePollOptions
  ): Promise<DiscordMessage[]> {
    this.ensureReady();

    try {
      const guild = await this.getGuild();
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        throw new APIError(
          `Channel not found: ${channelId}`,
          'DISCORD_CHANNEL_NOT_FOUND',
          404
        );
      }

      if (!channel.isTextBased()) {
        throw new APIError(
          `Channel ${channelId} is not a text channel`,
          'DISCORD_INVALID_CHANNEL_TYPE',
          400
        );
      }

      // Fetch messages
      const fetchOptions: {
        limit: number;
        after?: string;
        before?: string;
      } = {
        limit: options?.limit || 100,
      };

      if (options?.after) {
        fetchOptions.after = options.after;
      }

      if (options?.before) {
        fetchOptions.before = options.before;
      }

      const messages = await (channel as TextChannel).messages.fetch(
        fetchOptions
      );

      return this.convertMessages(messages as Collection<string, Message<boolean>>);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        `Failed to fetch messages from channel ${channelId}`,
        'DISCORD_FETCH_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Fetch messages from multiple channels
   */
  async fetchMessagesFromChannels(
    options: MessagePollOptions
  ): Promise<Map<string, DiscordMessage[]>> {
    const results = new Map<string, DiscordMessage[]>();

    for (const channelId of options.channelIds) {
      try {
        const messages = await this.fetchMessages(channelId, options);
        results.set(channelId, messages);
      } catch (error) {
        logger.error(`Failed to fetch messages from channel ${channelId}`, error instanceof Error ? error : new Error(String(error)));
        // Continue with other channels even if one fails
        results.set(channelId, []);
      }
    }

    return results;
  }

  /**
   * Get information about a specific channel
   */
  async getChannel(channelId: string): Promise<DiscordChannel> {
    this.ensureReady();

    try {
      const guild = await this.getGuild();
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        throw new APIError(
          `Channel not found: ${channelId}`,
          'DISCORD_CHANNEL_NOT_FOUND',
          404
        );
      }

      return {
        id: channel.id,
        name: channel.name,
        guildId: channel.guildId,
        type: this.mapChannelType(channel.type),
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        `Failed to get channel ${channelId}`,
        'DISCORD_CHANNEL_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Get guild information
   */
  async getGuildInfo(): Promise<DiscordGuild> {
    this.ensureReady();

    try {
      const guild = await this.getGuild();
      const channels = await guild.channels.fetch();

      return {
        id: guild.id,
        name: guild.name,
        channels: Array.from(channels.values())
          .filter((ch): ch is NonNullable<typeof ch> => ch !== null && 'id' in ch && 'name' in ch)
          .map((ch) => ({
            id: ch.id,
            name: ch.name,
            guildId: ch.guildId,
            type: this.mapChannelType(ch.type),
          })),
      };
    } catch (error) {
      throw new APIError(
        'Failed to get guild information',
        'DISCORD_GUILD_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Convert Discord.js messages to our message format
   */
  private convertMessages(
    messages: Collection<string, Message<boolean>>
  ): DiscordMessage[] {
    return Array.from(messages.values()).map((msg) => ({
      id: msg.id,
      channelId: msg.channelId,
      guildId: msg.guildId || '',
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        bot: msg.author.bot,
      },
      timestamp: msg.createdAt,
      mentions: msg.mentions.users.map((user) => user.id),
      attachments: Array.from(msg.attachments.values()).map((att) => ({
        id: att.id,
        filename: att.name || 'unknown',
        url: att.url,
        size: att.size,
        contentType: att.contentType || undefined,
      })),
    }));
  }

  /**
   * Map Discord.js channel type to our channel type
   */
  private mapChannelType(type: DJSChannelType): ChannelType {
    switch (type) {
      case DJSChannelType.GuildText:
        return 'TEXT' as ChannelType;
      case DJSChannelType.GuildVoice:
        return 'VOICE' as ChannelType;
      case DJSChannelType.GuildCategory:
        return 'CATEGORY' as ChannelType;
      case DJSChannelType.GuildAnnouncement:
        return 'ANNOUNCEMENT' as ChannelType;
      case DJSChannelType.PublicThread:
      case DJSChannelType.PrivateThread:
        return 'THREAD' as ChannelType;
      default:
        return 'TEXT' as ChannelType;
    }
  }

  /**
   * Send a message to a specific channel
   */
  async sendMessage(channelId: string, content: string): Promise<void> {
    this.ensureReady();

    try {
      const guild = await this.getGuild();
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        throw new APIError(
          `Channel not found: ${channelId}`,
          'DISCORD_CHANNEL_NOT_FOUND',
          404
        );
      }

      if (!channel.isTextBased()) {
        throw new APIError(
          `Channel ${channelId} is not a text channel`,
          'DISCORD_INVALID_CHANNEL_TYPE',
          400
        );
      }

      await (channel as TextChannel).send(content);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        `Failed to send message to channel ${channelId}`,
        'DISCORD_SEND_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Check if client is connected and ready
   */
  isConnected(): boolean {
    return this.isReady;
  }

  /**
   * Get the Discord client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get bot user ID
   */
  getBotUserId(): string | undefined {
    return this.client.user?.id;
  }
}
