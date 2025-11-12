/**
 * AI Error Classes
 * Errors related to AI service interactions (Claude, Gemini, Codex)
 */

import { BaseError } from './base.error';

export class AIError extends BaseError {
  constructor(
    message: string,
    code: string = 'AI_ERROR',
    context?: Record<string, any>
  ) {
    super(message, code, 500, true, context);
  }
}

// Removed unused AI-specific error classes:
// - ClaudeError, GeminiError, CodexError
// - AITimeoutError, AIExecutionError
// Use AIError directly with appropriate error codes if needed
