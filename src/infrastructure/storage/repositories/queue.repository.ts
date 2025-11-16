import type { Database } from 'better-sqlite3';
import { getSQLiteClient } from '../sqlite.client';

export interface QueuedTask {
  id: string;
  title: string;
  description?: string;
  url?: string;
  queuedAt: string;
  completedAt?: string;
  status: 'pending' | 'completed';
  repoPath?: string;
  owner?: string;
  repo?: string;
  branch: string;
  commitMessage: string;
  prTitle: string;
  prBody?: string;
  priority?: number;
}

/**
 * SQLite-based Queue Repository
 * Replaces lib/storage/queue.ts
 */
export class QueueRepository {
  private db: Database;

  constructor() {
    this.db = getSQLiteClient().getDB();
  }

  /**
   * Add task to queue
   */
  add(task: Omit<QueuedTask, 'queuedAt' | 'status'>): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO queue (
        id, title, description, url, queued_at, status,
        repo_path, owner, repo, branch, commit_message, pr_title, pr_body, priority
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.title,
      task.description || null,
      task.url || null,
      now,
      task.repoPath || null,
      task.owner || null,
      task.repo || null,
      task.branch,
      task.commitMessage,
      task.prTitle,
      task.prBody || null,
      task.priority || 0
    );
  }

  /**
   * Get pending tasks (ordered by priority, then queued time)
   */
  getPending(): QueuedTask[] {
    return this.db.prepare(`
      SELECT
        id,
        title,
        description,
        url,
        queued_at as queuedAt,
        completed_at as completedAt,
        status,
        repo_path as repoPath,
        owner,
        repo,
        branch,
        commit_message as commitMessage,
        pr_title as prTitle,
        pr_body as prBody,
        priority
      FROM queue
      WHERE status = 'pending'
      ORDER BY priority DESC, queued_at ASC
    `).all() as QueuedTask[];
  }

  /**
   * Get completed tasks
   */
  getCompleted(): QueuedTask[] {
    return this.db.prepare(`
      SELECT
        id,
        title,
        description,
        url,
        queued_at as queuedAt,
        completed_at as completedAt,
        status,
        repo_path as repoPath,
        owner,
        repo,
        branch,
        commit_message as commitMessage,
        pr_title as prTitle,
        pr_body as prBody,
        priority
      FROM queue
      WHERE status = 'completed'
      ORDER BY completed_at DESC
    `).all() as QueuedTask[];
  }

  /**
   * Get task by ID
   */
  get(id: string): QueuedTask | null {
    return this.db.prepare(`
      SELECT
        id,
        title,
        description,
        url,
        queued_at as queuedAt,
        completed_at as completedAt,
        status,
        repo_path as repoPath,
        owner,
        repo,
        branch,
        commit_message as commitMessage,
        pr_title as prTitle,
        pr_body as prBody,
        priority
      FROM queue
      WHERE id = ?
    `).get(id) as QueuedTask | null;
  }

  /**
   * Mark task as completed
   */
  markCompleted(id: string): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE queue
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `).run(now, id);
  }

  /**
   * Remove task from queue
   */
  remove(id: string): void {
    this.db.prepare(`
      DELETE FROM queue WHERE id = ?
    `).run(id);
  }

  /**
   * Update task priority
   */
  updatePriority(id: string, priority: number): void {
    this.db.prepare(`
      UPDATE queue
      SET priority = ?
      WHERE id = ?
    `).run(priority, id);
  }

  /**
   * Clear completed tasks older than specified time
   */
  clearOldCompleted(olderThanMs: number): number {
    const cutoffDate = new Date(Date.now() - olderThanMs).toISOString();

    const result = this.db.prepare(`
      DELETE FROM queue
      WHERE status = 'completed' AND completed_at < ?
    `).run(cutoffDate);

    return result.changes;
  }
}
