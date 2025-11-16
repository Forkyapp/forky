/**
 * Storage Layer - SQLite Backend
 * Migrated from JSON to SQLite (2025-11-16)
 *
 * This module provides backward-compatible API using SQLite repositories.
 * All writes go to SQLite database (data/timmy.db) instead of JSON files.
 *
 * Old JSON implementations preserved in:
 * - cache.ts, queue.ts, tracking.ts, review-tracking.ts, pipeline.ts, comments.ts
 */

export { cache, queue, tracking, reviewTracking, pipeline, processedComments } from './sqlite-adapter';

// Re-export types for backwards compatibility
export type {
  TaskData,
  ProcessedTask,
  QueueData,
  QueuedTask,
  TrackingEntry,
  PRCheckResult,
  PRFoundInfo,
  ReviewEntry,
  CommitCheckResult,
  StageEntry,
  PipelineData,
  PipelineSummary,
  RepoConfig
} from '../../src/types/storage';
