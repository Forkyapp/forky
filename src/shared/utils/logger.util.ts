/**
 * Logger Utility
 * Structured logging with levels and formatting
 */

import { isVerbose } from './verbose.util';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
  readonly error?: Error;
}

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly enableColors?: boolean;
  readonly enableTimestamp?: boolean;
  readonly prefix?: string;
}

class Logger {
  private level: LogLevel;
  private enableColors: boolean;
  private enableTimestamp: boolean;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.enableColors = options.enableColors ?? true;
    this.enableTimestamp = options.enableTimestamp ?? true;
    this.prefix = options.prefix ?? '';
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, { ...context, error: error?.message, stack: error?.stack });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.level) {
      return;
    }

    // Skip INFO and DEBUG logs when verbose mode is off
    // WARN and ERROR always show
    if ((level === LogLevel.INFO || level === LogLevel.DEBUG) && !isVerbose()) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    const formatted = this.format(entry);
    const output = level === LogLevel.ERROR ? console.error : console.log;
    output(formatted);
  }

  /**
   * Format log entry for output
   */
  private format(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.enableTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    // Level
    const levelName = this.getLevelName(entry.level);
    parts.push(this.colorize(levelName, entry.level));

    // Prefix
    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    // Message
    parts.push(entry.message);

    // Context
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context, null, 2));
    }

    return parts.join(' ');
  }

  /**
   * Get level name
   */
  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '[DEBUG]';
      case LogLevel.INFO:
        return '[INFO]';
      case LogLevel.WARN:
        return '[WARN]';
      case LogLevel.ERROR:
        return '[ERROR]';
      default:
        return '[UNKNOWN]';
    }
  }

  /**
   * Colorize text based on log level
   */
  private colorize(text: string, level: LogLevel): string {
    if (!this.enableColors) {
      return text;
    }

    const colors = {
      reset: '\x1b[0m',
      gray: '\x1b[90m',
      blue: '\x1b[34m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
    };

    switch (level) {
      case LogLevel.DEBUG:
        return `${colors.gray}${text}${colors.reset}`;
      case LogLevel.INFO:
        return `${colors.blue}${text}${colors.reset}`;
      case LogLevel.WARN:
        return `${colors.yellow}${text}${colors.reset}`;
      case LogLevel.ERROR:
        return `${colors.red}${text}${colors.reset}`;
      default:
        return text;
    }
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      enableColors: this.enableColors,
      enableTimestamp: this.enableTimestamp,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
    });
  }
}

// Default logger instance
export const logger = new Logger();

// Create logger with custom options
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
