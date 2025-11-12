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

// Removed unused Git-specific error classes:
// - GitOperationError, BranchExistsError
// - BranchNotFoundError, MergeConflictError
// Use RepositoryError directly with appropriate error codes if needed
