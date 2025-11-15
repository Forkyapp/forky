/**
 * AI Error Classes
 * Errors related to AI service interactions (Claude, Gemini, Codex)
 */

import { BaseError } from './base.error';

export class AIError extends BaseError {
  constructor(
    message: string,
    code: string = 'AI_ERROR',
    context?: Record<string, unknown>
  ) {
    super(message, code, 500, true, context);
  }
}

export class ClaudeError extends AIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CLAUDE_ERROR', context);
  }
}

export class GeminiError extends AIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GEMINI_ERROR', context);
  }
}

export class CodexError extends AIError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CODEX_ERROR', context);
  }
}

export class AITimeoutError extends AIError {
  public readonly timeoutMs: number;

  constructor(agent: string, timeoutMs: number, context?: Record<string, unknown>) {
    super(
      `${agent} operation timed out after ${timeoutMs}ms`,
      'AI_TIMEOUT_ERROR',
      { agent, timeoutMs, ...context }
    );
    this.timeoutMs = timeoutMs;
  }
}

export class AIExecutionError extends AIError {
  public readonly exitCode?: number;

  constructor(
    agent: string,
    message: string,
    exitCode?: number,
    context?: Record<string, unknown>
  ) {
    super(
      `${agent} execution failed: ${message}`,
      'AI_EXECUTION_ERROR',
      { agent, exitCode, ...context }
    );
    this.exitCode = exitCode;
  }
}
