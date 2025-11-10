/**
 * Retry Utility Tests
 */

import {
  withRetry,
  withRetryAndFallback,
  retryAll,
  isErrorRetryable,
  sleep,
  timeout,
  withTimeout,
} from '../retry.util';
import { NetworkError, RateLimitError, TimeoutError } from '../../errors';

describe('Retry Utility', () => {
  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError('Connection failed'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max attempts', async () => {
      const error = new NetworkError('Connection failed');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 3, delayMs: 10 })).rejects.toThrow(NetworkError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable error', async () => {
      const error = new Error('Non-retryable error');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 3, delayMs: 10 })).rejects.toThrow(Error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const error = new NetworkError('Connection failed');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      await withRetry(fn, { maxAttempts: 3, delayMs: 10, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error);
    });

    it('should apply exponential backoff', async () => {
      const startTime = Date.now();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError('Error 1'))
        .mockRejectedValueOnce(new NetworkError('Error 2'))
        .mockResolvedValue('success');

      await withRetry(fn, { maxAttempts: 3, delayMs: 100, backoffFactor: 2 });

      const elapsed = Date.now() - startTime;
      // First retry: ~100ms, Second retry: ~200ms, Total: ~300ms (with jitter)
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(elapsed).toBeLessThan(500);
    });

    it('should respect maxDelayMs', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new NetworkError('Error'))
        .mockResolvedValue('success');

      await withRetry(fn, {
        maxAttempts: 3,
        delayMs: 10000,
        maxDelayMs: 100,
      });

      // Should use maxDelayMs instead of calculated delay
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('withRetryAndFallback', () => {
    it('should return primary result on success', async () => {
      const primary = jest.fn().mockResolvedValue('primary');
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await withRetryAndFallback(primary, fallback);

      expect(result).toBe('primary');
      expect(primary).toHaveBeenCalledTimes(1);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should call fallback after all retries fail', async () => {
      const error = new NetworkError('Connection failed');
      const primary = jest.fn().mockRejectedValue(error);
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await withRetryAndFallback(primary, fallback, {
        maxAttempts: 2,
        delayMs: 10,
      });

      expect(result).toBe('fallback');
      expect(primary).toHaveBeenCalledTimes(2);
      expect(fallback).toHaveBeenCalledWith(error);
    });
  });

  describe('retryAll', () => {
    it('should retry all operations', async () => {
      const op1 = jest.fn().mockResolvedValue('result1');
      const op2 = jest.fn().mockResolvedValue('result2');

      const results = await retryAll([op1, op2], { delayMs: 10 });

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toBe('result1');
      }
      if (results[1].status === 'fulfilled') {
        expect(results[1].value).toBe('result2');
      }
    });

    it('should handle mixed success and failure', async () => {
      const op1 = jest.fn().mockResolvedValue('success');
      const op2 = jest.fn().mockRejectedValue(new Error('failure'));

      const results = await retryAll([op1, op2], { maxAttempts: 1, delayMs: 10 });

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });

  describe('isErrorRetryable', () => {
    it('should return true for NetworkError', () => {
      const error = new NetworkError('Connection failed');
      expect(isErrorRetryable(error)).toBe(true);
    });

    it('should return true for TimeoutError', () => {
      const error = new TimeoutError('Request timed out');
      expect(isErrorRetryable(error)).toBe(true);
    });

    it('should return true for RateLimitError', () => {
      const error = new RateLimitError('Rate limit exceeded');
      expect(isErrorRetryable(error)).toBe(true);
    });

    it('should return true for retryable error codes', () => {
      const codes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ENETUNREACH', 'EAI_AGAIN'];

      codes.forEach((code) => {
        const error = new Error('Network error') as any;
        error.code = code;
        expect(isErrorRetryable(error)).toBe(true);
      });
    });

    it('should return true for retryable HTTP status codes', () => {
      const statuses = [408, 429, 500, 502, 503, 504];

      statuses.forEach((status) => {
        const error = new Error('HTTP error') as any;
        error.response = { status };
        expect(isErrorRetryable(error)).toBe(true);
      });
    });

    it('should return false for non-retryable HTTP status codes', () => {
      const statuses = [400, 401, 403, 404];

      statuses.forEach((status) => {
        const error = new Error('HTTP error') as any;
        error.response = { status };
        expect(isErrorRetryable(error)).toBe(false);
      });
    });

    it('should return true for retryable error messages', () => {
      const messages = [
        'timeout occurred',
        'network error',
        'econnrefused',
        'rate limit exceeded',
        'too many requests',
        'service unavailable',
      ];

      messages.forEach((message) => {
        const error = new Error(message);
        expect(isErrorRetryable(error)).toBe(true);
      });
    });

    it('should return false for non-retryable errors', () => {
      const error = new Error('Invalid input');
      expect(isErrorRetryable(error)).toBe(false);
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const startTime = Date.now();
      await sleep(100);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(95);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('timeout', () => {
    it('should reject after specified duration', async () => {
      const promise = timeout(100, 'Custom timeout message');

      await expect(promise).rejects.toThrow(TimeoutError);
      await expect(promise).rejects.toThrow('Custom timeout message');
    });

    it('should use default message when not provided', async () => {
      const promise = timeout(100);

      await expect(promise).rejects.toThrow('Operation timed out after 100ms');
    });
  });

  describe('withTimeout', () => {
    it('should return result when operation completes before timeout', async () => {
      const fn = async () => {
        await sleep(50);
        return 'success';
      };

      const result = await withTimeout(fn, 200);
      expect(result).toBe('success');
    });

    it('should throw TimeoutError when operation exceeds timeout', async () => {
      const fn = async () => {
        await sleep(200);
        return 'success';
      };

      await expect(withTimeout(fn, 100)).rejects.toThrow(TimeoutError);
    });

    it('should use custom timeout message', async () => {
      const fn = async () => {
        await sleep(200);
        return 'success';
      };

      await expect(withTimeout(fn, 100, 'Custom timeout')).rejects.toThrow('Custom timeout');
    });
  });
});
