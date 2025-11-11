/**
 * Modular storage exports
 * Each storage concern is now in its own file
 */

export { cache } from './cache';
export { queue } from './queue';
export { tracking } from './tracking';
export { reviewTracking } from './review-tracking';
export { pipeline } from './pipeline';
export { processedComments } from './comments';

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
} from '../types';
