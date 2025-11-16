import type { Database } from 'better-sqlite3';
import { getSQLiteClient } from '../sqlite.client';

export interface ProcessedTask {
  id: string;
  title: string;
  description?: string;
  detectedAt: string;
  expiresAt: string;
}

/**
 * SQLite-based Cache Repository
 * Replaces lib/storage/cache.ts
 * Auto-cleanup handled by database triggers
 */
export class CacheRepository {
  private db: Database;

  constructor() {
    this.db = getSQLiteClient().getDB();
  }

  /**
   * Add task to cache (30-day expiration)
   */
  add(task: { id: string; title: string; description?: string }): void {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    this.db.prepare(`
      INSERT OR REPLACE INTO processed_tasks (id, title, description, detected_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(task.id, task.title, task.description || null, now, expiresAt);
  }

  /**
   * Check if task has been processed
   */
  has(taskId: string): boolean {
    const result = this.db.prepare(`
      SELECT 1 FROM processed_tasks
      WHERE id = ? AND expires_at > datetime('now')
    `).get(taskId);

    return !!result;
  }

  /**
   * Get all cached tasks
   */
  getAll(): ProcessedTask[] {
    return this.db.prepare(`
      SELECT
        id,
        title,
        description,
        detected_at as detectedAt,
        expires_at as expiresAt
      FROM processed_tasks
      WHERE expires_at > datetime('now')
      ORDER BY detected_at DESC
    `).all() as ProcessedTask[];
  }

  /**
   * Manually trigger cleanup of expired tasks
   */
  cleanup(): number {
    const result = this.db.prepare(`
      DELETE FROM processed_tasks
      WHERE expires_at < datetime('now')
    `).run();

    return result.changes;
  }

  /**
   * Clear all cached tasks (for testing)
   */
  clear(): void {
    this.db.prepare(`DELETE FROM processed_tasks`).run();
  }
}

/**
 * Comment Cache Repository
 * Replaces lib/storage/comments.ts
 */
export class CommentCacheRepository {
  private db: Database;

  constructor() {
    this.db = getSQLiteClient().getDB();
  }

  /**
   * Add comment to cache (30-day expiration)
   */
  add(commentId: string): void {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    this.db.prepare(`
      INSERT OR REPLACE INTO processed_comments (comment_id, processed_at, expires_at)
      VALUES (?, ?, ?)
    `).run(commentId, now, expiresAt);
  }

  /**
   * Check if comment has been processed
   */
  has(commentId: string): boolean {
    const result = this.db.prepare(`
      SELECT 1 FROM processed_comments
      WHERE comment_id = ? AND expires_at > datetime('now')
    `).get(commentId);

    return !!result;
  }

  /**
   * Manually trigger cleanup of expired comments
   */
  cleanup(): number {
    const result = this.db.prepare(`
      DELETE FROM processed_comments
      WHERE expires_at < datetime('now')
    `).run();

    return result.changes;
  }

  /**
   * Clear all cached comments (for testing)
   */
  clear(): void {
    this.db.prepare(`DELETE FROM processed_comments`).run();
  }
}
