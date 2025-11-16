import type { Database } from 'better-sqlite3';
import { getSQLiteClient } from '../sqlite.client';
import { logger } from '../../../shared/utils/logger.util';
import type { ProcessedMessage } from '../../../types/discord';

/**
 * SQLite-based Discord Message Repository
 * Replaces src/core/repositories/discord-message.repository.ts (JSON version)
 */
export class DiscordMessageRepository {
  private db: Database;

  constructor() {
    this.db = getSQLiteClient().getDB();
  }

  /**
   * Check if message has been processed
   */
  has(messageId: string): boolean {
    const result = this.db.prepare(`
      SELECT 1 FROM discord_messages
      WHERE message_id = ? AND expires_at > datetime('now')
    `).get(messageId);

    return !!result;
  }

  /**
   * Add processed message
   */
  add(message: ProcessedMessage): void {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // Store keywords as JSON array in content field
    const keywords = JSON.stringify(message.keywords);

    this.db.prepare(`
      INSERT OR REPLACE INTO discord_messages (message_id, channel_id, author_id, content, processed_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      message.messageId,
      message.channelId,
      '', // No author info in ProcessedMessage type
      keywords,
      now,
      expiresAt
    );
  }

  /**
   * Get all processed messages (for compatibility)
   */
  getAll(): ProcessedMessage[] {
    const rows = this.db.prepare(`
      SELECT
        message_id as messageId,
        channel_id as channelId,
        processed_at as processedAt,
        content
      FROM discord_messages
      WHERE expires_at > datetime('now')
      ORDER BY processed_at DESC
    `).all() as Array<{ messageId: string; channelId: string; processedAt: string; content: string }>;

    return rows.map(row => ({
      messageId: row.messageId,
      channelId: row.channelId,
      processedAt: new Date(row.processedAt),
      keywords: row.content ? JSON.parse(row.content) : []
    }));
  }

  /**
   * Cleanup old processed messages
   * @param olderThanDays Remove messages older than this many days (default: 30)
   */
  cleanup(olderThanDays: number = 30): void {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    const result = this.db.prepare(`
      DELETE FROM discord_messages
      WHERE processed_at < ?
    `).run(cutoffDate);

    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} old Discord messages`, {
        cutoffDate
      });
    }
  }

  /**
   * Clear all messages (for testing)
   */
  clear(): void {
    this.db.prepare(`DELETE FROM discord_messages`).run();
  }
}
