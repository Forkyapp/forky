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

// Removed unused helper functions:
// - isOperationalError, getErrorMessage, getErrorContext
// These are only used in tests, not in production code
