/**
 * Storage module - Re-exports modular storage components
 * This file maintains backwards compatibility while using the new modular structure
 */

// Re-export from modular storage for backwards compatibility
export { cache } from './storage/cache';
export { queue } from './storage/queue';
export { tracking } from './storage/tracking';
export { reviewTracking } from './storage/review-tracking';
export { pipeline } from './storage/pipeline';
export { processedComments } from './storage/comments';

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
} from './types';
