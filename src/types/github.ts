/**
 * GitHub Domain Types
 * Types for GitHub API interactions and repository management
 */

export interface GitHubBranchResult {
  readonly branch: string;
  readonly sha: string;
}

export interface GitHubPRResult {
  readonly number: number;
  readonly url: string;
  readonly branch: string;
}

export interface GitHubPRQueryResult {
  readonly found: boolean;
  readonly number?: number;
  readonly url?: string;
  readonly state?: string;
}

export interface GitHubDeleteBranchResult {
  readonly deleted: boolean;
  readonly branch: string;
}

export interface GitHubCommentResult {
  readonly success: boolean;
}

export interface GitHubPRCheckResult {
  readonly found: boolean;
  readonly url?: string;
  readonly number?: number;
  readonly state?: string;
}

export interface GitHubPRFoundInfo {
  readonly taskId: string;
  readonly taskName: string;
  readonly prNumber: number;
  readonly prUrl: string;
  readonly branch: string;
}

export interface GitHubCommitCheckResult {
  readonly isNew: boolean;
  readonly sha?: string;
  readonly message?: string;
  readonly isReview?: boolean;
  readonly isFix?: boolean;
}
