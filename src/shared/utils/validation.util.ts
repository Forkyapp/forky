/**
 * Validation Utility
 * Helper functions for data validation
 */

import { ValidationError, ValidationIssue } from '../errors';

/**
 * Validate that a value is not null or undefined
 */
export function required<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} is required`, [
      { field: fieldName, message: 'Required field is missing' },
    ]);
  }
  return value;
}

/**
 * Validate that a string is not empty
 */
export function notEmpty(value: string, fieldName: string): string {
  required(value, fieldName);
  if (value.trim().length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, [
      { field: fieldName, message: 'String cannot be empty' },
    ]);
  }
  return value;
}

/**
 * Validate that a number is within range
 */
export function inRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): number {
  required(value, fieldName);
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, [
      { field: fieldName, message: `Value ${value} is out of range [${min}, ${max}]` },
    ]);
  }
  return value;
}

/**
 * Validate that a value is one of allowed values
 */
export function oneOf<T>(
  value: T,
  allowedValues: readonly T[],
  fieldName: string
): T {
  required(value, fieldName);
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      [
        {
          field: fieldName,
          message: `Value ${value} is not in allowed list`,
          value,
        },
      ]
    );
  }
  return value;
}

/**
 * Validate URL format
 */
export function isValidUrl(value: string, fieldName: string): string {
  notEmpty(value, fieldName);
  try {
    new URL(value);
    return value;
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`, [
      { field: fieldName, message: 'Invalid URL format', value },
    ]);
  }
}

/**
 * Validate email format
 */
export function isValidEmail(value: string, fieldName: string): string {
  notEmpty(value, fieldName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid email`, [
      { field: fieldName, message: 'Invalid email format', value },
    ]);
  }
  return value;
}

/**
 * Validate path format (no dangerous characters)
 */
export function isValidPath(value: string, fieldName: string): string {
  notEmpty(value, fieldName);
  // Check for dangerous path traversal patterns
  if (value.includes('..') || value.includes('~')) {
    throw new ValidationError(`${fieldName} contains invalid path characters`, [
      { field: fieldName, message: 'Path contains dangerous patterns', value },
    ]);
  }
  return value;
}

/**
 * Validate that array has items
 */
export function notEmptyArray<T>(value: readonly T[], fieldName: string): readonly T[] {
  required(value, fieldName);
  if (value.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, [
      { field: fieldName, message: 'Array cannot be empty' },
    ]);
  }
  return value;
}

/**
 * Validate minimum length
 */
export function minLength(value: string, min: number, fieldName: string): string {
  notEmpty(value, fieldName);
  if (value.length < min) {
    throw new ValidationError(
      `${fieldName} must be at least ${min} characters`,
      [
        {
          field: fieldName,
          message: `Length ${value.length} is less than minimum ${min}`,
        },
      ]
    );
  }
  return value;
}

/**
 * Validate maximum length
 */
export function maxLength(value: string, max: number, fieldName: string): string {
  required(value, fieldName);
  if (value.length > max) {
    throw new ValidationError(
      `${fieldName} must be at most ${max} characters`,
      [
        {
          field: fieldName,
          message: `Length ${value.length} exceeds maximum ${max}`,
        },
      ]
    );
  }
  return value;
}

/**
 * Validate against regex pattern
 */
export function matchesPattern(
  value: string,
  pattern: RegExp,
  fieldName: string,
  errorMessage?: string
): string {
  notEmpty(value, fieldName);
  if (!pattern.test(value)) {
    throw new ValidationError(
      errorMessage || `${fieldName} does not match required pattern`,
      [{ field: fieldName, message: 'Value does not match pattern', value }]
    );
  }
  return value;
}

/**
 * Batch validate multiple fields
 */
export function validateAll(
  validators: ReadonlyArray<() => void>
): void {
  const issues: ValidationIssue[] = [];

  for (const validator of validators) {
    try {
      validator();
    } catch (error) {
      if (error instanceof ValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
  }

  if (issues.length > 0) {
    throw ValidationError.fromIssues(issues);
  }
}

/**
 * Safe parse JSON with validation
 */
export function parseJSON<T>(
  value: string,
  fieldName: string,
  validator?: (data: unknown) => T
): T {
  notEmpty(value, fieldName);
  try {
    const parsed = JSON.parse(value);
    if (validator) {
      return validator(parsed);
    }
    return parsed;
  } catch (error) {
    throw new ValidationError(`${fieldName} is not valid JSON`, [
      {
        field: fieldName,
        message: error instanceof Error ? error.message : 'Invalid JSON',
      },
    ]);
  }
}
