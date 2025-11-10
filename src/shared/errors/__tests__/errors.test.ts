/**
 * Error Classes Tests
 * Basic tests for custom error classes
 */

import {
  ValidationError,
  ValidationIssue,
  APIError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  FileReadError,
  FileWriteError,
  StorageError,
  RepositoryError,
  AIError,
} from '../index';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create error with message and issues', () => {
      const issues: ValidationIssue[] = [
        { field: 'email', message: 'Invalid email' },
      ];
      const error = new ValidationError('Validation failed', issues);
      expect(error.message).toBe('Validation failed');
      expect(error.issues).toEqual(issues);
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create error from issues using static method', () => {
      const issues: ValidationIssue[] = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const error = ValidationError.fromIssues(issues);
      expect(error.message).toBe('Validation failed: Invalid email, Too short');
      expect(error.issues).toEqual(issues);
    });
  });

  describe('APIError', () => {
    it('should create error with code and status', () => {
      const error = new APIError('API request failed', 'API_ERROR', 500);
      expect(error.message).toBe('API request failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('API_ERROR');
      expect(error.name).toBe('APIError');
    });

    it('should include context when provided', () => {
      const context = { error: 'Internal server error' };
      const error = new APIError('API request failed', 'API_ERROR', 500, context);
      expect(error.context).toEqual(context);
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Connection failed');
      expect(error.message).toBe('Connection failed');
      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBe(503);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.message).toBe('Too many requests');
      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
    });

    it('should include retry after when provided', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('Request timed out');
      expect(error.message).toBe('Request timed out');
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.statusCode).toBe(504);
    });
  });

  describe('FileReadError', () => {
    it('should create file read error', () => {
      const cause = new Error('ENOENT');
      const error = new FileReadError('/path/to/file', cause);
      expect(error.message).toContain('/path/to/file');
      expect(error.name).toBe('FileReadError');
      expect(error.code).toBe('FILE_READ_ERROR');
    });
  });

  describe('FileWriteError', () => {
    it('should create file write error', () => {
      const cause = new Error('EACCES');
      const error = new FileWriteError('/path/to/file', cause);
      expect(error.message).toContain('/path/to/file');
      expect(error.name).toBe('FileWriteError');
      expect(error.code).toBe('FILE_WRITE_ERROR');
    });
  });

  describe('StorageError', () => {
    it('should create storage error', () => {
      const error = new StorageError('Storage operation failed');
      expect(error.message).toBe('Storage operation failed');
      expect(error.name).toBe('StorageError');
      expect(error.code).toBe('STORAGE_ERROR');
    });
  });

  describe('RepositoryError', () => {
    it('should create repository error', () => {
      const error = new RepositoryError('Repository operation failed');
      expect(error.message).toBe('Repository operation failed');
      expect(error.name).toBe('RepositoryError');
      expect(error.code).toBe('REPOSITORY_ERROR');
    });
  });

  describe('AIError', () => {
    it('should create AI error', () => {
      const error = new AIError('AI request failed');
      expect(error.message).toBe('AI request failed');
      expect(error.name).toBe('AIError');
      expect(error.code).toBe('AI_ERROR');
    });
  });

  describe('Error serialization', () => {
    it('should serialize error to JSON', () => {
      const error = new APIError('API failed', 'API_ERROR', 500);
      const json = error.toJSON();

      expect(json.message).toBe('API failed');
      expect(json.statusCode).toBe(500);
      expect(json.code).toBe('API_ERROR');
      expect(json.timestamp).toBeDefined();
    });
  });
});
