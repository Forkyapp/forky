/**
 * Validation Error Classes
 * Errors related to data validation and input sanitization
 */

import { BaseError } from './base.error';

export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
}

export class ValidationError extends BaseError {
  public readonly issues: readonly ValidationIssue[];

  constructor(
    message: string,
    issues: readonly ValidationIssue[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
    this.issues = issues;
  }

  static fromIssues(issues: readonly ValidationIssue[]): ValidationError {
    const message = `Validation failed: ${issues.map((i) => i.message).join(', ')}`;
    return new ValidationError(message, issues);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', 500, true, context);
  }
}

export class MissingConfigError extends ConfigurationError {
  constructor(configKey: string, context?: Record<string, unknown>) {
    super(
      `Missing required configuration: ${configKey}`,
      { configKey, ...context }
    );
  }
}

export class InvalidConfigError extends ConfigurationError {
  constructor(configKey: string, reason: string, context?: Record<string, unknown>) {
    super(
      `Invalid configuration for ${configKey}: ${reason}`,
      { configKey, reason, ...context }
    );
  }
}
