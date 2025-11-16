/**
 * Application Constants
 * Centralized constant values used throughout the application
 */

// Pipeline stages
export const PIPELINE_STAGES = {
  DETECTED: 'detected',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  IMPLEMENTING: 'implementing',
  IMPLEMENTED: 'implemented',
  CODEX_REVIEWING: 'codex_reviewing',
  CODEX_REVIEWED: 'codex_reviewed',
  QWEN_TESTING: 'qwen_testing',
  QWEN_TESTED: 'qwen_tested',
  CLAUDE_FIXING: 'claude_fixing',
  CLAUDE_FIXED: 'claude_fixed',
  MERGING: 'merging',
  MERGED: 'merged',
  PR_CREATING: 'pr_creating',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Pipeline statuses
export const PIPELINE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  POLL_INTERVAL_MS: 15000, // 15 seconds
  PR_CHECK_INTERVAL_MS: 30000, // 30 seconds
  PR_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  MAX_REVIEW_ITERATIONS: 3,
  DEFAULT_BRANCH: 'main',
  AI_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
} as const;

// File paths (relative to project root)
export const FILE_PATHS = {
  // Cache files
  CACHE: 'data/cache/processed-tasks.json',
  PROCESSED_COMMENTS: 'data/cache/processed-comments.json',

  // State files
  QUEUE: 'data/state/task-queue.json',
  PIPELINE: 'data/state/pipeline-state.json',

  // Tracking files
  PR_TRACKING: 'data/tracking/pr-tracking.json',
  REVIEW_TRACKING: 'data/tracking/review-tracking.json',

  // Directories
  FEATURES_DIR: 'docs/features',
  LOGS_DIR: 'logs',
  PROGRESS_DIR: 'progress',
  DATA_DIR: 'data',

  // Configuration (workspace-based)
  PROJECTS_CONFIG: 'projects.json',
  WORKSPACE_CONFIG: 'workspace.json',
} as const;

// CLI command names
export const CLI_COMMANDS = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  CODEX: 'codex',
  QWEN: 'qwen',
  GIT: 'git',
  GH: 'gh',
} as const;

// ClickUp command types
export const CLICKUP_COMMANDS = {
  RERUN_CODEX_REVIEW: 'rerun-codex-review',
  RERUN_CLAUDE_FIXES: 'rerun-claude-fixes',
} as const;

// ClickUp status values
export const CLICKUP_STATUS = {
  TO_DO: 'to do',
  BOT_IN_PROGRESS: 'bot in progress',
  CAN_BE_CHECKED: 'can be checked',
  IN_REVIEW: 'in review',
  DONE: 'done',
} as const;

// Git branch naming
export const BRANCH_PREFIX = 'task-';
export const CLAUDE_BRANCH_PREFIX = 'claude/';

// Error codes
export const ERROR_CODES = {
  // API errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',

  // Configuration errors
  MISSING_CONFIG: 'MISSING_CONFIG',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // AI errors
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_EXECUTION_ERROR: 'AI_EXECUTION_ERROR',

  // Storage errors
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  PIPELINE_NOT_FOUND: 'PIPELINE_NOT_FOUND',

  // Repository errors
  REPO_NOT_FOUND: 'REPO_NOT_FOUND',
  GIT_OPERATION_ERROR: 'GIT_OPERATION_ERROR',
  BRANCH_EXISTS: 'BRANCH_EXISTS',
  MERGE_CONFLICT: 'MERGE_CONFLICT',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_FACTOR: 2,
  JITTER_FACTOR: 0.3,
} as const;

// AI agent names
export const AI_AGENTS = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  CODEX: 'codex',
  QWEN: 'qwen',
} as const;

// Review cycle configuration
export const REVIEW_CONFIG = {
  MAX_ITERATIONS: 3,
  STAGES: {
    WAITING_FOR_CODEX_REVIEW: 'waiting_for_codex_review',
    WAITING_FOR_CLAUDE_FIXES: 'waiting_for_claude_fixes',
    COMPLETED: 'completed',
  },
} as const;

// Regular expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TASK_ID: /^[a-z0-9]+$/i,
  BRANCH_NAME: /^[a-zA-Z0-9/_-]+$/,
  REPO_TAG: /^repo:(.+)$/i,
  REPO_DESCRIPTION: /\[Repo(?:sitory)?:\s*([^\]]+)\]/i,
} as const;

// Environment variable keys
export const ENV_KEYS = {
  // ClickUp
  CLICKUP_API_KEY: 'CLICKUP_API_KEY',
  CLICKUP_BOT_USER_ID: 'CLICKUP_BOT_USER_ID',
  CLICKUP_WORKSPACE_ID: 'CLICKUP_WORKSPACE_ID',

  // GitHub
  GITHUB_TOKEN: 'GITHUB_TOKEN',
  GITHUB_OWNER: 'GITHUB_OWNER',
  GITHUB_REPO: 'GITHUB_REPO',
  GITHUB_REPO_PATH: 'GITHUB_REPO_PATH',
  GITHUB_BASE_BRANCH: 'GITHUB_BASE_BRANCH',

  // System
  POLL_INTERVAL_MS: 'POLL_INTERVAL_MS',
  CLAUDE_CLI_PATH: 'CLAUDE_CLI_PATH',
  GEMINI_CLI_PATH: 'GEMINI_CLI_PATH',
  CODEX_CLI_PATH: 'CODEX_CLI_PATH',
  QWEN_CLI_PATH: 'QWEN_CLI_PATH',

  // Auto-create repos
  AUTO_CREATE_REPO: 'AUTO_CREATE_REPO',
  AUTO_REPO_PRIVATE: 'AUTO_REPO_PRIVATE',
  AUTO_REPO_BASE_DIR: 'AUTO_REPO_BASE_DIR',
  AUTO_REPO_DEFAULT_BRANCH: 'AUTO_REPO_DEFAULT_BRANCH',

  // Features
  DISABLE_COMMENTS: 'DISABLE_COMMENTS',
} as const;
