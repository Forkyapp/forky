import type { Database } from 'better-sqlite3';
import { getSQLiteClient } from '../sqlite.client';

export interface ReviewEntry {
  taskId: string;
  taskName: string;
  branch: string;
  prNumber: number;
  prUrl: string;
  stage: 'waiting_for_codex_review' | 'waiting_for_claude_fixes';
  iteration: number;
  maxIterations: number;
  startedAt: string;
  lastCommitSha?: string;
  lastCheckedAt?: string;
  repository?: string;
  owner?: string;
  repo?: string;
  repoPath?: string;
}

export interface PRTrackingEntry {
  taskId: string;
  taskName: string;
  branch: string;
  startedAt: string;
  prNumber?: number;
  prUrl?: string;
  lastCheckedAt?: string;
  repository?: string;
  owner?: string;
  repo?: string;
  repoPath?: string;
}

/**
 * SQLite-based Review Tracking Repository
 * Replaces lib/storage/review-tracking.ts
 */
export class ReviewTrackingRepository {
  private db: Database;

  constructor() {
    this.db = getSQLiteClient().getDB();
  }

  /**
   * Start a new review cycle
   */
  start(entry: Omit<ReviewEntry, 'startedAt' | 'iteration' | 'lastCheckedAt'>): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO reviews (
        task_id, task_name, branch, pr_number, pr_url, stage,
        iteration, max_iterations, started_at,
        last_commit_sha, repository, owner, repo, repo_path
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.taskId,
      entry.taskName,
      entry.branch,
      entry.prNumber,
      entry.prUrl,
      entry.stage,
      entry.maxIterations || 3,
      now,
      entry.lastCommitSha || null,
      entry.repository || null,
      entry.owner || null,
      entry.repo || null,
      entry.repoPath || null
    );
  }

  /**
   * Get review entry by task ID
   */
  get(taskId: string): ReviewEntry | null {
    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        branch,
        pr_number as prNumber,
        pr_url as prUrl,
        stage,
        iteration,
        max_iterations as maxIterations,
        started_at as startedAt,
        last_commit_sha as lastCommitSha,
        last_checked_at as lastCheckedAt,
        repository,
        owner,
        repo,
        repo_path as repoPath
      FROM reviews
      WHERE task_id = ?
    `).get(taskId) as ReviewEntry | null;
  }

  /**
   * Get all active reviews
   */
  getAll(): ReviewEntry[] {
    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        branch,
        pr_number as prNumber,
        pr_url as prUrl,
        stage,
        iteration,
        max_iterations as maxIterations,
        started_at as startedAt,
        last_commit_sha as lastCommitSha,
        last_checked_at as lastCheckedAt,
        repository,
        owner,
        repo,
        repo_path as repoPath
      FROM reviews
      ORDER BY started_at ASC
    `).all() as ReviewEntry[];
  }

  /**
   * Update review stage
   */
  updateStage(taskId: string, stage: 'waiting_for_codex_review' | 'waiting_for_claude_fixes'): void {
    this.db.prepare(`
      UPDATE reviews
      SET stage = ?
      WHERE task_id = ?
    `).run(stage, taskId);
  }

  /**
   * Update last commit SHA
   */
  updateCommit(taskId: string, commitSha: string): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE reviews
      SET last_commit_sha = ?, last_checked_at = ?
      WHERE task_id = ?
    `).run(commitSha, now, taskId);
  }

  /**
   * Increment iteration
   */
  incrementIteration(taskId: string): void {
    this.db.prepare(`
      UPDATE reviews
      SET iteration = iteration + 1
      WHERE task_id = ?
    `).run(taskId);
  }

  /**
   * Update last checked timestamp
   */
  updateLastChecked(taskId: string): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE reviews
      SET last_checked_at = ?
      WHERE task_id = ?
    `).run(now, taskId);
  }

  /**
   * Remove review entry
   */
  remove(taskId: string): void {
    this.db.prepare(`
      DELETE FROM reviews WHERE task_id = ?
    `).run(taskId);
  }

  /**
   * Get reviews that need checking (not checked in last 30 seconds)
   */
  getNeedingCheck(intervalSeconds: number = 30): ReviewEntry[] {
    const cutoffTime = new Date(Date.now() - intervalSeconds * 1000).toISOString();

    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        branch,
        pr_number as prNumber,
        pr_url as prUrl,
        stage,
        iteration,
        max_iterations as maxIterations,
        started_at as startedAt,
        last_commit_sha as lastCommitSha,
        last_checked_at as lastCheckedAt,
        repository,
        owner,
        repo,
        repo_path as repoPath
      FROM reviews
      WHERE last_checked_at IS NULL OR last_checked_at < ?
      ORDER BY started_at ASC
    `).all(cutoffTime) as ReviewEntry[];
  }
}

/**
 * SQLite-based PR Tracking Repository
 * Replaces lib/storage/tracking.ts
 */
export class PRTrackingRepository {
  private db: Database;

  constructor() {
    this.db = getSQLiteClient().getDB();
  }

  /**
   * Start PR tracking
   */
  start(entry: Omit<PRTrackingEntry, 'startedAt' | 'lastCheckedAt'>): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO pr_tracking (
        task_id, task_name, branch, started_at,
        pr_number, pr_url, repository, owner, repo, repo_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.taskId,
      entry.taskName,
      entry.branch,
      now,
      entry.prNumber || null,
      entry.prUrl || null,
      entry.repository || null,
      entry.owner || null,
      entry.repo || null,
      entry.repoPath || null
    );
  }

  /**
   * Get PR tracking entry by task ID
   */
  get(taskId: string): PRTrackingEntry | null {
    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        branch,
        started_at as startedAt,
        pr_number as prNumber,
        pr_url as prUrl,
        last_checked_at as lastCheckedAt,
        repository,
        owner,
        repo,
        repo_path as repoPath
      FROM pr_tracking
      WHERE task_id = ?
    `).get(taskId) as PRTrackingEntry | null;
  }

  /**
   * Get all PR tracking entries
   */
  getAll(): PRTrackingEntry[] {
    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        branch,
        started_at as startedAt,
        pr_number as prNumber,
        pr_url as prUrl,
        last_checked_at as lastCheckedAt,
        repository,
        owner,
        repo,
        repo_path as repoPath
      FROM pr_tracking
      ORDER BY started_at ASC
    `).all() as PRTrackingEntry[];
  }

  /**
   * Update PR details
   */
  update(taskId: string, prNumber: number, prUrl: string): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE pr_tracking
      SET pr_number = ?, pr_url = ?, last_checked_at = ?
      WHERE task_id = ?
    `).run(prNumber, prUrl, now, taskId);
  }

  /**
   * Update last checked timestamp
   */
  updateLastChecked(taskId: string): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE pr_tracking
      SET last_checked_at = ?
      WHERE task_id = ?
    `).run(now, taskId);
  }

  /**
   * Remove PR tracking entry
   */
  remove(taskId: string): void {
    this.db.prepare(`
      DELETE FROM pr_tracking WHERE task_id = ?
    `).run(taskId);
  }

  /**
   * Get entries needing check (not checked in last 30 seconds)
   */
  getNeedingCheck(intervalSeconds: number = 30): PRTrackingEntry[] {
    const cutoffTime = new Date(Date.now() - intervalSeconds * 1000).toISOString();

    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        branch,
        started_at as startedAt,
        pr_number as prNumber,
        pr_url as prUrl,
        last_checked_at as lastCheckedAt,
        repository,
        owner,
        repo,
        repo_path as repoPath
      FROM pr_tracking
      WHERE pr_number IS NULL AND (last_checked_at IS NULL OR last_checked_at < ?)
      ORDER BY started_at ASC
    `).all(cutoffTime) as PRTrackingEntry[];
  }
}
