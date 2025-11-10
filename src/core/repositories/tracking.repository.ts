/**
 * Tracking Repositories
 * Manages PR tracking and review cycle tracking
 */

import fs from 'fs';
import {
  TrackingEntry,
  ReviewEntry,
  ClickUpTaskData,
  GitHubPRFoundInfo,
} from '../../types';
import { FileReadError, FileWriteError } from '../../shared/errors';

// ============================================
// PR Tracking Repository
// ============================================

export interface IPRTrackingRepository {
  load(): Promise<TrackingEntry[]>;
  save(data: TrackingEntry[]): Promise<void>;
  start(task: ClickUpTaskData, config: { owner?: string; repo?: string }): Promise<void>;
  remove(taskId: string): Promise<void>;
  getAll(): Promise<TrackingEntry[]>;
  init(): Promise<void>;
}

export class PRTrackingRepository implements IPRTrackingRepository {
  private data: TrackingEntry[] = [];

  constructor(private readonly filePath: string) {}

  async load(): Promise<TrackingEntry[]> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const content = fs.readFileSync(this.filePath, 'utf8');
      this.data = JSON.parse(content);
      return this.data;
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  async save(data: TrackingEntry[]): Promise<void> {
    try {
      this.data = data;
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  async start(
    task: ClickUpTaskData,
    config: { owner?: string; repo?: string }
  ): Promise<void> {
    const entry: TrackingEntry = {
      taskId: task.id,
      taskName: task.name || task.title || '',
      branch: `task-${task.id}`,
      startedAt: new Date().toISOString(),
      owner: config.owner,
      repo: config.repo,
    };

    this.data.push(entry);
    await this.save(this.data);
  }

  async remove(taskId: string): Promise<void> {
    this.data = this.data.filter((e) => e.taskId !== taskId);
    await this.save(this.data);
  }

  async getAll(): Promise<TrackingEntry[]> {
    return [...this.data];
  }

  async init(): Promise<void> {
    await this.load();
  }
}

// ============================================
// Review Tracking Repository
// ============================================

export interface IReviewTrackingRepository {
  load(): Promise<ReviewEntry[]>;
  save(data: ReviewEntry[]): Promise<void>;
  startReviewCycle(
    task: ClickUpTaskData,
    prInfo: Partial<GitHubPRFoundInfo>,
    repoConfig: { repository?: string; owner?: string; repo?: string; repoPath?: string }
  ): Promise<boolean>;
  updateStage(taskId: string, stage: string): Promise<void>;
  updateIteration(taskId: string, iteration: number): Promise<void>;
  updateCommitSha(taskId: string, sha: string): Promise<void>;
  remove(taskId: string): Promise<void>;
  get(taskId: string): Promise<ReviewEntry | null>;
  getAll(): Promise<ReviewEntry[]>;
  init(): Promise<void>;
}

export class ReviewTrackingRepository implements IReviewTrackingRepository {
  private data: ReviewEntry[] = [];

  constructor(private readonly filePath: string) {}

  async load(): Promise<ReviewEntry[]> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const content = fs.readFileSync(this.filePath, 'utf8');
      this.data = JSON.parse(content);
      return this.data;
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  async save(data: ReviewEntry[]): Promise<void> {
    try {
      this.data = data;
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  async startReviewCycle(
    task: ClickUpTaskData,
    prInfo: Partial<GitHubPRFoundInfo>,
    repoConfig: { repository?: string; owner?: string; repo?: string; repoPath?: string }
  ): Promise<boolean> {
    // Check if already exists
    const existing = this.data.find((r) => r.taskId === task.id);
    if (existing) {
      return false;
    }

    const entry: ReviewEntry = {
      taskId: task.id,
      taskName: task.name || task.title || '',
      branch: prInfo.branch || `task-${task.id}`,
      prNumber: prInfo.prNumber || 0,
      prUrl: prInfo.prUrl || '',
      stage: 'waiting_for_codex_review',
      iteration: 0,
      maxIterations: 3,
      startedAt: new Date().toISOString(),
      lastCommitSha: null,
      repository: repoConfig.repository,
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      repoPath: repoConfig.repoPath,
    };

    this.data.push(entry);
    await this.save(this.data);

    return true;
  }

  async updateStage(taskId: string, stage: string): Promise<void> {
    const entry = this.data.find((e) => e.taskId === taskId);
    if (entry) {
      (entry as any).stage = stage;
      await this.save(this.data);
    }
  }

  async updateIteration(taskId: string, iteration: number): Promise<void> {
    const entry = this.data.find((e) => e.taskId === taskId);
    if (entry) {
      (entry as any).iteration = iteration;
      await this.save(this.data);
    }
  }

  async updateCommitSha(taskId: string, sha: string): Promise<void> {
    const entry = this.data.find((e) => e.taskId === taskId);
    if (entry) {
      (entry as any).lastCommitSha = sha;
      await this.save(this.data);
    }
  }

  async remove(taskId: string): Promise<void> {
    this.data = this.data.filter((e) => e.taskId !== taskId);
    await this.save(this.data);
  }

  async get(taskId: string): Promise<ReviewEntry | null> {
    return this.data.find((e) => e.taskId === taskId) || null;
  }

  async getAll(): Promise<ReviewEntry[]> {
    return [...this.data];
  }

  async init(): Promise<void> {
    await this.load();
  }
}

// ============================================
// Processed Comments Repository
// ============================================

export interface IProcessedCommentsRepository {
  load(): Promise<Set<string>>;
  save(commentIds: Set<string>): Promise<void>;
  has(commentId: string): Promise<boolean>;
  add(commentId: string): Promise<void>;
  init(): Promise<void>;
}

export class ProcessedCommentsRepository implements IProcessedCommentsRepository {
  private commentIds: Set<string> = new Set();

  constructor(private readonly filePath: string) {}

  async load(): Promise<Set<string>> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return new Set();
      }

      const content = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(content);
      this.commentIds = new Set(data);
      return this.commentIds;
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  async save(commentIds: Set<string>): Promise<void> {
    try {
      this.commentIds = commentIds;
      fs.writeFileSync(this.filePath, JSON.stringify([...commentIds], null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  async has(commentId: string): Promise<boolean> {
    return this.commentIds.has(commentId);
  }

  async add(commentId: string): Promise<void> {
    this.commentIds.add(commentId);
    await this.save(this.commentIds);
  }

  async init(): Promise<void> {
    await this.load();
  }
}
