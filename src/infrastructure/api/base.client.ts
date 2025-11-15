/**
 * Base API Client
 * Foundation for all API clients with retry logic and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { withRetry, RetryOptions } from '../../shared/utils';
import {
  APIError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  NotFoundError,
} from '../../shared/errors';
import { HTTP_STATUS } from '../../shared/constants';

export interface BaseClientConfig {
  readonly baseURL: string;
  readonly headers?: Record<string, string>;
  readonly timeout?: number;
  readonly retryOptions?: RetryOptions;
}

export abstract class BaseAPIClient {
  protected readonly client: AxiosInstance;
  protected readonly retryOptions: RetryOptions;

  constructor(config: BaseClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: config.headers || {},
      timeout: config.timeout || 30000,
    });

    this.retryOptions = config.retryOptions || {
      maxAttempts: 3,
      delayMs: 1000,
      backoffFactor: 2,
    };

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  /**
   * GET request with retry logic
   */
  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return withRetry(async () => {
      const response = await this.client.get<T>(url, config);
      return response.data;
    }, this.retryOptions);
  }

  /**
   * POST request with retry logic
   */
  protected async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return withRetry(async () => {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    }, this.retryOptions);
  }

  /**
   * PUT request with retry logic
   */
  protected async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return withRetry(async () => {
      const response = await this.client.put<T>(url, data, config);
      return response.data;
    }, this.retryOptions);
  }

  /**
   * DELETE request with retry logic
   */
  protected async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return withRetry(async () => {
      const response = await this.client.delete<T>(url, config);
      return response.data;
    }, this.retryOptions);
  }

  /**
   * Handle API errors and convert to custom error types
   */
  private handleError(error: AxiosError): never {
    const response = error.response;
    const message = this.extractErrorMessage(error);

    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new NetworkError(message, { code: error.code });
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new TimeoutError(message, { code: error.code });
    }

    // HTTP errors
    if (response) {
      const status = response.status;

      // Rate limit
      if (status === HTTP_STATUS.RATE_LIMITED) {
        const retryAfter = response.headers['retry-after'];
        throw new RateLimitError(
          message,
          retryAfter ? parseInt(retryAfter) : undefined,
          { status, data: response.data }
        );
      }

      // Not found
      if (status === HTTP_STATUS.NOT_FOUND) {
        throw new NotFoundError('Resource', 'Unknown', { status, data: response.data });
      }

      // Other HTTP errors
      throw new APIError(message, 'API_ERROR', status, {
        status,
        data: response.data,
      });
    }

    // Generic API error
    throw new APIError(message, 'API_ERROR', 500, { originalError: error.message });
  }

  /**
   * Extract meaningful error message from axios error
   */
  private extractErrorMessage(error: AxiosError): string {
    if (error.response?.data) {
      const data = error.response.data as { message?: string; error?: string } | string;
      if (typeof data === 'string') return data;
      if (typeof data === 'object' && data.message) return data.message;
      if (typeof data === 'object' && data.error) return data.error;
    }

    return error.message || 'Unknown API error';
  }
}
