/**
 * Common/Shared Types
 * Reusable types used across multiple domains
 */

export interface SuccessResult {
  readonly success: true;
}

export interface ErrorResult {
  readonly success: false;
  readonly error: string;
}

export type Result<T = void> = (T extends void ? SuccessResult : SuccessResult & T) | ErrorResult;

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
}

export interface RetryableOperation<T> {
  (): Promise<T>;
}

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly delayMs?: number;
  readonly backoffFactor?: number;
  readonly maxDelayMs?: number;
  readonly onRetry?: (attempt: number, error: Error) => void;
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}
