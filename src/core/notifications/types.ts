/**
 * Notification Types - Type definitions for notification system
 */

/**
 * Notification channel
 */
export type NotificationChannel = 'clickup' | 'discord' | 'console';

/**
 * Notification severity level
 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * Base notification payload
 */
export interface NotificationPayload {
  /** Task ID this notification relates to */
  taskId: string;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Severity level */
  level: NotificationLevel;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow notification data
 */
export interface WorkflowNotification {
  /** Task ID */
  taskId: string;
  /** Workflow status */
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  /** Current or completed stage */
  stage?: string;
  /** Branch name */
  branch?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Stage notification data
 */
export interface StageNotification {
  /** Task ID */
  taskId: string;
  /** Stage name */
  stage: string;
  /** Stage status */
  status: 'started' | 'completed' | 'failed';
  /** Result details */
  details?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
}

/**
 * Rerun notification data
 */
export interface RerunNotification {
  /** Task ID */
  taskId: string;
  /** Stage being rerun */
  stage: 'codex_review' | 'claude_fixes';
  /** Rerun status */
  status: 'completed' | 'failed';
  /** Branch name */
  branch?: string;
  /** Error message if failed */
  error?: string;
}
