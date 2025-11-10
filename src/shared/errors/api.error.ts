/**
 * API Error Classes
 * Errors related to external API calls (ClickUp, GitHub, etc.)
 */

import { BaseError } from './base.error';

export class APIError extends BaseError {
  constructor(
    message: string,
    code: string = 'API_ERROR',
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, true, context);
  }
}

export class ClickUpAPIError extends APIError {
  constructor(message: string, statusCode: number = 500, context?: Record<string, any>) {
    super(message, 'CLICKUP_API_ERROR', statusCode, context);
  }
}

export class GitHubAPIError extends APIError {
  constructor(message: string, statusCode: number = 500, context?: Record<string, any>) {
    super(message, 'GITHUB_API_ERROR', statusCode, context);
  }
}

export class NetworkError extends APIError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', 503, context);
  }
}

export class RateLimitError extends APIError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, context?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 429, context);
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends APIError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', 504, context);
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string, identifier: string, context?: Record<string, any>) {
    super(
      `${resource} not found: ${identifier}`,
      'NOT_FOUND_ERROR',
      404,
      { resource, identifier, ...context }
    );
  }
}
