/**
 * Retry Utility
 * Provides retry logic with exponential backoff for failed operations
 */

import { RetryOptions } from '../../types';
import { NetworkError, RateLimitError, TimeoutError } from '../errors';

interface ErrorWithCode extends Error {
  code?: string;
  response?: {
    status: number;
  };
}

/**
 * Execute an operation with automatic retry on failure
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of successful execution
 * @throws Last error if all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffFactor = 2,
    maxDelayMs = 30000,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isErrorRetryable(lastError);

      // Last attempt or non-retryable error
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(delayMs * Math.pow(backoffFactor, attempt - 1), maxDelayMs);

      // Add jitter (30% randomness to prevent thundering herd)
      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = Math.round(delay + jitter);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(totalDelay);
    }
  }

  throw lastError;
}

/**
 * Execute operation with retry and fallback function
 * @param fn - Primary function to execute
 * @param fallbackFn - Fallback function to execute if all retries fail
 * @param options - Retry configuration options
 * @returns Result from primary or fallback function
 */
export async function withRetryAndFallback<T>(
  fn: () => Promise<T>,
  fallbackFn: (error: Error) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await withRetry(fn, options);
  } catch (error) {
    return await fallbackFn(error as Error);
  }
}

/**
 * Retry multiple operations in parallel
 * @param operations - Array of async functions to execute
 * @param options - Retry configuration options
 * @returns Array of settled results
 */
export async function retryAll<T>(
  operations: ReadonlyArray<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<PromiseSettledResult<T>[]> {
  const promises = operations.map((op) => withRetry(op, options));
  return Promise.allSettled(promises);
}

/**
 * Check if an error is retryable based on type and status
 * @param error - Error to check
 * @returns True if error should trigger a retry
 */
export function isErrorRetryable(error: Error): boolean {
  // Custom error classes that are retryable
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }

  // Rate limit errors are retryable
  if (error instanceof RateLimitError) {
    return true;
  }

  const errorWithCode = error as ErrorWithCode;

  // Check error code for network issues
  const retryableCodes = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNRESET',
    'ENETUNREACH',
    'EAI_AGAIN',
  ];

  if (errorWithCode.code && retryableCodes.includes(errorWithCode.code)) {
    return true;
  }

  // Check HTTP status codes
  if (errorWithCode.response) {
    const status = errorWithCode.response.status;
    // Retry on 408 (timeout), 429 (rate limit), 5xx (server errors)
    if (status === 408 || status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
  }

  // Check error message patterns
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'timeout',
    'network',
    'econnrefused',
    'rate limit',
    'too many requests',
    'service unavailable',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after specified duration
 * @param ms - Timeout duration in milliseconds
 * @param message - Optional timeout error message
 * @returns Promise that rejects after timeout
 */
export function timeout(ms: number, message?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Execute function with timeout
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Optional timeout error message
 * @returns Result of function execution
 * @throws TimeoutError if operation exceeds timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([fn(), timeout(timeoutMs, timeoutMessage)]);
}
