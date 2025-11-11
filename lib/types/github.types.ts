/**
 * GitHub related type definitions
 */

export interface BranchResult {
  branch: string;
  sha: string;
}

export interface PRResult {
  number: number;
  url: string;
  branch: string;
}

export interface PRQueryResult {
  found: boolean;
  number?: number;
  url?: string;
  state?: string;
}

export interface DeleteBranchResult {
  deleted: boolean;
  branch: string;
}

export interface CommentResult {
  success: boolean;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  url: string;
  cloned: boolean;
}

export interface EnsureRepoOptions {
  owner?: string | null;
  autoCreate?: boolean;
  baseDir?: string;
  isPrivate?: boolean;
  baseBranch?: string;
}
