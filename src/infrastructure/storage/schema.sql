-- Timmy SQLite Database Schema
-- Migration from JSON storage to SQLite
-- Created: 2025-11-16

-- ============================================================================
-- PIPELINES - Main workflow state tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipelines (
  task_id TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  failed_at TEXT,
  total_duration INTEGER,
  repository TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_current_stage ON pipelines(current_stage);
CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at);

-- ============================================================================
-- STAGES - Individual pipeline stage executions
-- ============================================================================
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration INTEGER,
  error TEXT,
  FOREIGN KEY (pipeline_task_id) REFERENCES pipelines(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stages_pipeline_id ON stages(pipeline_task_id);
CREATE INDEX IF NOT EXISTS idx_stages_stage ON stages(stage);

-- ============================================================================
-- PIPELINE_METADATA - Dynamic metadata storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipeline_metadata (
  pipeline_task_id TEXT PRIMARY KEY,
  gemini_analysis_file TEXT,
  gemini_analysis_fallback INTEGER DEFAULT 0,
  pr_number INTEGER,
  review_iterations INTEGER DEFAULT 0,
  max_review_iterations INTEGER DEFAULT 3,
  branches TEXT, -- JSON array
  agent_execution TEXT, -- JSON object
  FOREIGN KEY (pipeline_task_id) REFERENCES pipelines(task_id) ON DELETE CASCADE
);

-- ============================================================================
-- PIPELINE_ERRORS - Error tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipeline_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_task_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  error TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (pipeline_task_id) REFERENCES pipelines(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_errors_pipeline_id ON pipeline_errors(pipeline_task_id);
CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON pipeline_errors(timestamp);

-- ============================================================================
-- QUEUE - Task queue management
-- ============================================================================
CREATE TABLE IF NOT EXISTS queue (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  queued_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
  repo_path TEXT,
  owner TEXT,
  repo TEXT,
  branch TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  pr_title TEXT NOT NULL,
  pr_body TEXT,
  priority INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_queued_at ON queue(queued_at);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON queue(priority DESC);

-- ============================================================================
-- PROCESSED_TASKS - Deduplication cache
-- ============================================================================
CREATE TABLE IF NOT EXISTS processed_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days'))
);

CREATE INDEX IF NOT EXISTS idx_processed_tasks_expires ON processed_tasks(expires_at);

-- Auto-cleanup trigger
CREATE TRIGGER IF NOT EXISTS cleanup_expired_tasks
AFTER INSERT ON processed_tasks
BEGIN
  DELETE FROM processed_tasks WHERE expires_at < datetime('now');
END;

-- ============================================================================
-- PROCESSED_COMMENTS - Comment deduplication
-- ============================================================================
CREATE TABLE IF NOT EXISTS processed_comments (
  comment_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days'))
);

CREATE INDEX IF NOT EXISTS idx_processed_comments_expires ON processed_comments(expires_at);

-- Auto-cleanup trigger
CREATE TRIGGER IF NOT EXISTS cleanup_expired_comments
AFTER INSERT ON processed_comments
BEGIN
  DELETE FROM processed_comments WHERE expires_at < datetime('now');
END;

-- ============================================================================
-- REVIEWS - Review cycle tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  task_id TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_url TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('waiting_for_codex_review', 'waiting_for_claude_fixes')),
  iteration INTEGER NOT NULL DEFAULT 0,
  max_iterations INTEGER NOT NULL DEFAULT 3,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_commit_sha TEXT,
  last_checked_at TEXT,
  repository TEXT,
  owner TEXT,
  repo TEXT,
  repo_path TEXT,
  FOREIGN KEY (task_id) REFERENCES pipelines(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_stage ON reviews(stage);
CREATE INDEX IF NOT EXISTS idx_reviews_last_checked ON reviews(last_checked_at);

-- ============================================================================
-- PR_TRACKING - PR creation tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS pr_tracking (
  task_id TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  pr_number INTEGER,
  pr_url TEXT,
  last_checked_at TEXT,
  repository TEXT,
  owner TEXT,
  repo TEXT,
  repo_path TEXT,
  FOREIGN KEY (task_id) REFERENCES pipelines(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pr_tracking_last_checked ON pr_tracking(last_checked_at);

-- ============================================================================
-- DISCORD_MESSAGES - Processed Discord messages cache
-- ============================================================================
CREATE TABLE IF NOT EXISTS discord_messages (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days'))
);

CREATE INDEX IF NOT EXISTS idx_discord_messages_expires ON discord_messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_discord_messages_channel ON discord_messages(channel_id);

-- Auto-cleanup trigger for Discord messages
CREATE TRIGGER IF NOT EXISTS cleanup_expired_discord_messages
AFTER INSERT ON discord_messages
BEGIN
  DELETE FROM discord_messages WHERE expires_at < datetime('now');
END;

-- ============================================================================
-- MIGRATIONS - Schema version tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial migration
INSERT OR IGNORE INTO migrations (version, name) VALUES (1, 'initial_schema');
