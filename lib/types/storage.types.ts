/**
 * Storage related type definitions
 */

export interface TaskData {
  id: string;
  name: string;
  title?: string;
  description?: string;
  text_content?: string;
  url?: string;
}

export interface ProcessedTask {
  id: string;
  title: string;
  description: string;
  detectedAt: string;
}

export interface QueueData {
  pending: QueuedTask[];
  completed: QueuedTask[];
}

export interface QueuedTask {
  id: string;
  title: string;
  description: string;
  url?: string;
  queuedAt: string;
  repoPath?: string;
  owner?: string;
  repo?: string;
  branch: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export interface TrackingEntry {
  taskId: string;
  taskName: string;
  branch: string;
  startedAt: string;
  owner?: string;
  repo?: string;
}

export interface PRCheckResult {
  found: boolean;
  url?: string;
  number?: number;
  state?: string;
}

export interface PRFoundInfo {
  taskId: string;
  taskName: string;
  prNumber: number;
  prUrl: string;
  branch: string;
}

export interface ReviewEntry {
  taskId: string;
  taskName: string;
  branch: string;
  prNumber: number;
  prUrl: string;
  stage: string;
  iteration: number;
  maxIterations: number;
  startedAt: string;
  lastCommitSha: string | null;
  repository?: string;
  owner?: string;
  repo?: string;
  repoPath?: string;
}

export interface CommitCheckResult {
  isNew: boolean;
  sha?: string;
  message?: string;
  isReview?: boolean;
  isFix?: boolean;
}

export interface StageEntry {
  name: string;
  stage: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  [key: string]: any;
}

export interface PipelineData {
  taskId: string;
  taskName: string;
  currentStage: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  totalDuration?: number;
  stages: StageEntry[];
  metadata: {
    geminiAnalysis?: any;
    aiInstances?: any[];
    branches?: any[];
    prNumber?: number | null;
    reviewIterations?: number;
    maxReviewIterations?: number;
    agentExecution?: {
      gemini?: any;
      claude?: any;
      codex?: any;
    };
    repository?: string;
    [key: string]: any;
  };
  errors: Array<{
    stage: string;
    error: string;
    timestamp: string;
  }>;
}

export interface PipelineSummary {
  taskId: string;
  taskName: string;
  currentStage: string;
  status: string;
  progress: number;
  duration: number;
  reviewIterations: number;
  hasErrors: boolean;
}

export interface RepoConfig {
  owner: string;
  repo: string;
  path: string;
  baseBranch?: string;
  token?: string;
}
