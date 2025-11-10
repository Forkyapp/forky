/**
 * Repository Error Classes
 * Errors related to repository operations and Git
 */

import { BaseError } from './base.error';

export class RepositoryError extends BaseError {
  constructor(
    message: string,
    code: string = 'REPOSITORY_ERROR',
    context?: Record<string, any>
  ) {
    super(message, code, 500, true, context);
  }
}

export class RepositoryNotFoundError extends RepositoryError {
  constructor(repoName: string, context?: Record<string, any>) {
    super(
      `Repository not found: ${repoName}`,
      'REPOSITORY_NOT_FOUND_ERROR',
      { repoName, ...context }
    );
  }
}

export class GitOperationError extends RepositoryError {
  public readonly command?: string;

  constructor(
    operation: string,
    message: string,
    command?: string,
    context?: Record<string, any>
  ) {
    super(
      `Git ${operation} failed: ${message}`,
      'GIT_OPERATION_ERROR',
      { operation, command, ...context }
    );
    this.command = command;
  }
}

export class BranchExistsError extends RepositoryError {
  constructor(branchName: string, context?: Record<string, any>) {
    super(
      `Branch already exists: ${branchName}`,
      'BRANCH_EXISTS_ERROR',
      { branchName, ...context }
    );
  }
}

export class BranchNotFoundError extends RepositoryError {
  constructor(branchName: string, context?: Record<string, any>) {
    super(
      `Branch not found: ${branchName}`,
      'BRANCH_NOT_FOUND_ERROR',
      { branchName, ...context }
    );
  }
}

export class MergeConflictError extends RepositoryError {
  public readonly conflicts: readonly string[];

  constructor(conflicts: readonly string[], context?: Record<string, any>) {
    super(
      `Merge conflict detected in ${conflicts.length} file(s)`,
      'MERGE_CONFLICT_ERROR',
      { conflicts, ...context }
    );
    this.conflicts = conflicts;
  }
}
