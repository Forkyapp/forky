import { forky } from './ui';

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number | null;
  retryableErrors?: string[];
  onRetry?: ((attempt: number, error: Error, delay: number) => Promise<void>) | null;
}

interface ErrorWithCode extends Error {
  code?: string;
  response?: {
    status: number;
  };
}

/**
 * Retry a function with exponential backoff
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of successful execution
 */
async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
    timeoutMs = null,
    retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'],
    onRetry = null
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Apply timeout if specified
      if (timeoutMs) {
        return await Promise.race([
          fn(),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
          )
        ]);
      }

      return await fn();

    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isErrorRetryable(lastError, retryableErrors);

      // Last attempt or non-retryable error
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(backoffFactor, attempt - 1),
        maxDelayMs
      );

      // Add jitter (30% randomness)
      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = Math.round(delay + jitter);

      console.log(forky.warning(
        `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`
      ));
      console.log(forky.info(`Retrying in ${totalDelay}ms...`));

      // Call retry callback if provided
      if (onRetry) {
        await onRetry(attempt, lastError, totalDelay);
      }

      await sleep(totalDelay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable
 */
function isErrorRetryable(error: Error, retryableErrors: string[]): boolean {
  const errorWithCode = error as ErrorWithCode;

  // Check error code
  if (errorWithCode.code && retryableErrors.includes(errorWithCode.code)) {
    return true;
  }

  // Check error name
  if (error.name && retryableErrors.includes(error.name)) {
    return true;
  }

  // Check HTTP status codes
  if (errorWithCode.response) {
    const status = errorWithCode.response.status;
    // Retry on 429 (rate limit), 5xx (server errors)
    if (status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
  }

  // Check error message patterns
  const message = error.message.toLowerCase();
  if (message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with custom error handling
 */
async function withRetryAndFallback<T>(
  fn: () => Promise<T>,
  fallbackFn: (error: Error) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await withRetry(fn, options);
  } catch (error) {
    console.log(forky.warning('All retry attempts failed, using fallback'));
    return await fallbackFn(error as Error);
  }
}

/**
 * Retry multiple operations in parallel
 */
async function retryAll<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<PromiseSettledResult<T>[]> {
  const promises = operations.map(op => withRetry(op, options));
  return Promise.allSettled(promises);
}

export {
  withRetry,
  withRetryAndFallback,
  retryAll,
  isErrorRetryable,
  sleep,
  RetryOptions,
  ErrorWithCode
};
