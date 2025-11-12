/**
 * Storage Error Classes
 * Errors related to data persistence and file operations
 */

import { BaseError } from './base.error';

export class StorageError extends BaseError {
  constructor(
    message: string,
    code: string = 'STORAGE_ERROR',
    context?: Record<string, any>
  ) {
    super(message, code, 500, true, context);
  }
}

export class FileReadError extends StorageError {
  constructor(filePath: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Failed to read file: ${filePath}`,
      'FILE_READ_ERROR',
      { filePath, originalError: originalError?.message, ...context }
    );
  }
}

export class FileWriteError extends StorageError {
  constructor(filePath: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Failed to write file: ${filePath}`,
      'FILE_WRITE_ERROR',
      { filePath, originalError: originalError?.message, ...context }
    );
  }
}

// Removed unused FileNotFoundError and DataCorruptionError
// Use StorageError directly if needed

export class PipelineNotFoundError extends StorageError {
  constructor(taskId: string, context?: Record<string, any>) {
    super(
      `Pipeline not found for task: ${taskId}`,
      'PIPELINE_NOT_FOUND_ERROR',
      { taskId, ...context }
    );
  }
}
