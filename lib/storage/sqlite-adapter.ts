/**
 * SQLite Storage Adapter
 * Provides backward-compatible API using SQLite repositories
 * Replaces JSON file storage with SQLite database
 *
 * NOTE: This is a compatibility layer with type casts to bridge
 * the old JSON API with the new SQLite repositories.
 */

import {
  PipelineRepository,
  QueueRepository,
  CacheRepository,
  CommentCacheRepository,
  ReviewTrackingRepository,
  PRTrackingRepository
} from '../../src/infrastructure/storage/repositories';

// Initialize repositories (singleton pattern)
const pipelineRepo = new PipelineRepository();
const queueRepo = new QueueRepository();
const cacheRepo = new CacheRepository();
const commentRepo = new CommentCacheRepository();
const reviewRepo = new ReviewTrackingRepository();
const prRepo = new PRTrackingRepository();

/**
 * Cache adapter (replaces lib/storage/cache.ts)
 */
export const cache = {
  init(): void {
    // Initialize SQLite database on first call
    cacheRepo.getAll();
  },

  load(): any[] {
    return cacheRepo.getAll() as any;
  },

  save(): void {
    // No-op: SQLite writes immediately
  },

  has(taskId: string): boolean {
    return cacheRepo.has(taskId);
  },

  add(task: any): void {
    cacheRepo.add({
      id: task.id,
      title: task.name || task.title || 'Unknown',
      description: task.description
    });
  }
};

/**
 * Queue adapter (replaces lib/storage/queue.ts)
 */
export const queue = {
  init(): void {
    // No-op: SQLite auto-initializes
  },

  load(): any {
    return {
      pending: queueRepo.getPending(),
      completed: queueRepo.getCompleted()
    } as any;
  },

  save(): void {
    // No-op: SQLite writes immediately
  },

  add(task: any): void {
    queueRepo.add(task as any);
  },

  getPending(): any[] {
    return queueRepo.getPending() as any;
  },

  getCompleted(): any[] {
    return queueRepo.getCompleted() as any;
  },

  moveToCompleted(taskId: string): void {
    queueRepo.markCompleted(taskId);
  },

  remove(taskId: string): void {
    queueRepo.remove(taskId);
  }
};

/**
 * Pipeline adapter (replaces lib/storage/pipeline.ts)
 */
export const pipeline = {
  init(taskId: string, taskName: string, repository?: string): any {
    return pipelineRepo.init(taskId, taskName, repository) as any;
  },

  load(): any {
    // Return all pipelines as object keyed by taskId
    const all = pipelineRepo.getActive();
    const result: Record<string, any> = {};
    for (const p of all) {
      result[p.taskId] = p;
    }
    return result;
  },

  save(): void {
    // No-op: SQLite writes immediately
  },

  get(taskId: string): any {
    const full = pipelineRepo.getFull(taskId);
    if (!full) return null;

    // Merge back to old format
    return {
      ...full.pipeline,
      stages: full.stages,
      metadata: full.metadata || {},
      errors: full.errors
    } as any;
  },

  updateStage(taskId: string, stage: string, stageData: any = {}): any {
    pipelineRepo.updateStage(taskId, stage, stageData.status || 'in_progress');
    return this.get(taskId);
  },

  completeStage(taskId: string, stage: string, duration?: number): any {
    pipelineRepo.completeStage(taskId, stage, duration);
    return this.get(taskId);
  },

  failStage(taskId: string, stage: string, error: string): any {
    pipelineRepo.failStage(taskId, stage, error);
    return this.get(taskId);
  },

  updateMetadata(taskId: string, metadata: any): any {
    pipelineRepo.updateMetadata(taskId, metadata);
    return this.get(taskId);
  },

  complete(taskId: string, totalDuration?: number): any {
    pipelineRepo.complete(taskId, totalDuration);
    return this.get(taskId);
  },

  fail(taskId: string, error: string): any {
    pipelineRepo.fail(taskId, error);
    return this.get(taskId);
  },

  getActive(): any[] {
    return pipelineRepo.getActive() as any;
  },

  cleanup(olderThanMs: number): number {
    return pipelineRepo.cleanup(olderThanMs);
  },

  getSummary(taskId: string): any {
    const full = pipelineRepo.getFull(taskId);
    if (!full) return null;

    return {
      taskId: full.pipeline.taskId,
      taskName: full.pipeline.taskName,
      status: full.pipeline.status,
      currentStage: full.pipeline.currentStage,
      duration: full.pipeline.totalDuration,
      stageCount: full.stages.length,
      errorCount: full.errors.length
    } as any;
  },

  storeAgentExecution(taskId: string, agent: string, data: any): void {
    const metadata = pipelineRepo.getMetadata(taskId);
    const agentExecution = metadata?.agentExecution || {};
    agentExecution[agent] = data;
    pipelineRepo.updateMetadata(taskId, { agentExecution });
  },

  getAgentExecution(taskId: string, agent: string): any {
    const metadata = pipelineRepo.getMetadata(taskId);
    return metadata?.agentExecution?.[agent];
  }
};

/**
 * Review tracking adapter (replaces lib/storage/review-tracking.ts)
 */
export const reviewTracking = {
  init(): void {
    // No-op: SQLite auto-initializes
  },

  load(): any[] {
    return reviewRepo.getAll() as any;
  },

  save(): void {
    // No-op: SQLite writes immediately
  },

  startReviewCycle(entry: any): void {
    reviewRepo.start(entry as any);
  },

  updateLastCommitSha(taskId: string, commitSha: string): void {
    reviewRepo.updateCommit(taskId, commitSha);
  },

  incrementIteration(taskId: string): void {
    reviewRepo.incrementIteration(taskId);
  },

  updateStage(taskId: string, stage: any): void {
    reviewRepo.updateStage(taskId, stage);
  },

  remove(taskId: string): void {
    reviewRepo.remove(taskId);
  },

  get(taskId: string): any {
    return reviewRepo.get(taskId) as any;
  },

  checkForNewCommit(taskId: string, currentCommitSha: string): any {
    const entry = reviewRepo.get(taskId);
    if (!entry) {
      return { hasNewCommit: false };
    }

    const hasNewCommit = entry.lastCommitSha !== currentCommitSha;
    return {
      hasNewCommit,
      lastCommitSha: entry.lastCommitSha,
      currentCommitSha
    };
  },

  poll(): any[] {
    return reviewRepo.getNeedingCheck(30) as any;
  }
};

/**
 * PR tracking adapter (replaces lib/storage/tracking.ts)
 */
export const tracking = {
  init(): void {
    // No-op: SQLite auto-initializes
  },

  load(): any[] {
    return prRepo.getAll() as any;
  },

  save(): void {
    // No-op: SQLite writes immediately
  },

  start(entry: any): void {
    prRepo.start(entry as any);
  },

  update(taskId: string, prNumber: number, prUrl: string): void {
    prRepo.update(taskId, prNumber, prUrl);
  },

  remove(taskId: string): void {
    prRepo.remove(taskId);
  },

  get(taskId: string): any {
    return prRepo.get(taskId) as any;
  },

  checkForPR(taskId: string, _currentPRNumber: number | null): any {
    const entry = prRepo.get(taskId);
    if (!entry) {
      return { hasPR: false };
    }

    if (entry.prNumber && entry.prUrl) {
      return {
        hasPR: true,
        prInfo: {
          prNumber: entry.prNumber,
          prUrl: entry.prUrl
        }
      };
    }

    return { hasPR: false };
  },

  poll(): any[] {
    return prRepo.getNeedingCheck(30) as any;
  }
};

/**
 * Comment cache adapter (replaces lib/storage/comments.ts)
 */
export const processedComments = {
  init(): void {
    // No-op: SQLite auto-initializes
  },

  load(): string[] {
    // Old API returned array of comment IDs - not critical for migration
    return [];
  },

  save(): void {
    // No-op: SQLite writes immediately
  },

  has(commentId: string): boolean {
    return commentRepo.has(commentId);
  },

  add(commentId: string): void {
    commentRepo.add(commentId);
  }
};
