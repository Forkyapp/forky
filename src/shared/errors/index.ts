/**
 * Error Classes Export
 * Centralized error class exports
 */

// Base error
export * from './base.error';

// API errors
export * from './api.error';

// Validation errors
export * from './validation.error';

// AI errors
export * from './ai.error';

// Storage errors
export * from './storage.error';

// Repository errors
export * from './repository.error';

/**
 * Type guard to check if an error is operational
 */
export function isOperationalError(error: Error): boolean {
  if ('isOperational' in error) {
    return (error as { isOperational?: boolean }).isOperational === true;
  }
  return false;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Extract error context safely
 */
export function getErrorContext(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof Error && 'context' in error) {
    return (error as { context?: Record<string, unknown> }).context;
  }
  return undefined;
}
