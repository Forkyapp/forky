/**
 * Storage Error Classes
 * Errors related to data persistence and file operations
 */

import { BaseError } from './base.error';

export class StorageError extends BaseError {
  constructor(
    message: string,
    code: string = 'STORAGE_ERROR',
    context?: Record<string, unknown>
  ) {
    super(message, code, 500, true, context);
  }
}

export class FileReadError extends StorageError {
  constructor(filePath: string, originalError?: Error, context?: Record<string, unknown>) {
    super(
      `Failed to read file: ${filePath}`,
      'FILE_READ_ERROR',
      { filePath, originalError: originalError?.message, ...context }
    );
  }
}

export class FileWriteError extends StorageError {
  constructor(filePath: string, originalError?: Error, context?: Record<string, unknown>) {
    super(
      `Failed to write file: ${filePath}`,
      'FILE_WRITE_ERROR',
      { filePath, originalError: originalError?.message, ...context }
    );
  }
}

export class FileNotFoundError extends StorageError {
  constructor(filePath: string, context?: Record<string, unknown>) {
    super(
      `File not found: ${filePath}`,
      'FILE_NOT_FOUND_ERROR',
      { filePath, ...context }
    );
  }
}

export class DataCorruptionError extends StorageError {
  constructor(dataType: string, reason: string, context?: Record<string, unknown>) {
    super(
      `Data corruption detected in ${dataType}: ${reason}`,
      'DATA_CORRUPTION_ERROR',
      { dataType, reason, ...context }
    );
  }
}

export class PipelineNotFoundError extends StorageError {
  constructor(taskId: string, context?: Record<string, unknown>) {
    super(
      `Pipeline not found for task: ${taskId}`,
      'PIPELINE_NOT_FOUND_ERROR',
      { taskId, ...context }
    );
  }
}
