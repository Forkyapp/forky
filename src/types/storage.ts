/**
 * Storage and State Management Types
 * Types for data persistence and pipeline state tracking
 */

// Cache types
export interface ProcessedTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly detectedAt: string;
}

// Queue types
export interface QueuedTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly url?: string;
  readonly queuedAt: string;
  readonly repoPath?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly branch: string;
  readonly commitMessage: string;
  readonly prTitle: string;
  readonly prBody: string;
}

export interface QueueData {
  pending: QueuedTask[];
  completed: QueuedTask[];
}

// Tracking types
export interface TrackingEntry {
  readonly taskId: string;
  readonly taskName: string;
  readonly branch: string;
  readonly startedAt: string;
  readonly owner?: string;
  readonly repo?: string;
}

export interface ReviewEntry {
  readonly taskId: string;
  readonly taskName: string;
  readonly branch: string;
  readonly prNumber: number;
  readonly prUrl: string;
  readonly stage: string;
  readonly iteration: number;
  readonly maxIterations: number;
  readonly startedAt: string;
  readonly lastCommitSha: string | null;
  readonly repository?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly repoPath?: string;
}

// Pipeline types
export type PipelineStage =
  | 'detected'
  | 'analyzing'
  | 'analyzed'
  | 'implementing'
  | 'implemented'
  | 'codex_reviewing'
  | 'codex_reviewed'
  | 'claude_fixing'
  | 'claude_fixed'
  | 'merging'
  | 'merged'
  | 'pr_creating'
  | 'completed'
  | 'failed';

export type PipelineStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface StageEntry {
  readonly name: string;
  readonly stage: string;
  status: PipelineStatus;
  readonly startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  readonly [key: string]: any;
}

export interface PipelineMetadata {
  readonly geminiAnalysis?: any;
  readonly aiInstances?: readonly any[];
  readonly branches?: readonly any[];
  readonly prNumber?: number | null;
  readonly reviewIterations?: number;
  readonly maxReviewIterations?: number;
  readonly agentExecution?: {
    readonly gemini?: any;
    readonly claude?: any;
    readonly codex?: any;
  };
  readonly repository?: string;
  readonly [key: string]: any;
}

export interface PipelineError {
  readonly stage: string;
  readonly error: string;
  readonly timestamp: string;
}

export interface PipelineData {
  readonly taskId: string;
  readonly taskName: string;
  currentStage: string;
  status: PipelineStatus;
  readonly createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  totalDuration?: number;
  stages: StageEntry[];
  metadata: PipelineMetadata;
  errors: PipelineError[];
}

export interface PipelineSummary {
  readonly taskId: string;
  readonly taskName: string;
  readonly currentStage: string;
  readonly status: PipelineStatus;
  readonly progress: number;
  readonly duration: number;
  readonly reviewIterations: number;
  readonly hasErrors: boolean;
}

// Constants
export interface PipelineStages {
  readonly DETECTED: 'detected';
  readonly ANALYZING: 'analyzing';
  readonly ANALYZED: 'analyzed';
  readonly IMPLEMENTING: 'implementing';
  readonly IMPLEMENTED: 'implemented';
  readonly CODEX_REVIEWING: 'codex_reviewing';
  readonly CODEX_REVIEWED: 'codex_reviewed';
  readonly CLAUDE_FIXING: 'claude_fixing';
  readonly CLAUDE_FIXED: 'claude_fixed';
  readonly MERGING: 'merging';
  readonly MERGED: 'merged';
  readonly PR_CREATING: 'pr_creating';
  readonly COMPLETED: 'completed';
  readonly FAILED: 'failed';
}

export interface PipelineStatuses {
  readonly PENDING: 'pending';
  readonly IN_PROGRESS: 'in_progress';
  readonly COMPLETED: 'completed';
  readonly FAILED: 'failed';
  readonly SKIPPED: 'skipped';
}
