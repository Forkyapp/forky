/**
 * Stage Types - Unified type definitions for all pipeline stages
 *
 * This module defines common types used across all stages in the workflow pipeline.
 * Each stage should implement StageResult and use StageContext for execution.
 */

import type { ClickUpTask } from '@/types/clickup';
import type { RepositoryConfig } from '@/shared/config';

// ============================================
// STAGE CONTEXT
// ============================================

/**
 * Base context passed to all stages
 */
export interface StageContext {
  /** The ClickUp task being processed */
  task: ClickUpTask;
  /** Task ID (shorthand for task.id) */
  taskId: string;
  /** Task name (shorthand for task.name) */
  taskName: string;
  /** Repository configuration */
  repoConfig: RepositoryConfig;
  /** Path to isolated worktree (if using worktrees) */
  worktreePath?: string;
}

/**
 * Extended context for implementation stage (includes analysis)
 */
export interface ImplementationStageContext extends StageContext {
  /** Result from analysis stage */
  analysis: AnalysisResult | null;
}

// ============================================
// STAGE RESULTS
// ============================================

/**
 * Base result interface for all stages
 */
export interface BaseStageResult {
  /** Whether the stage succeeded */
  success: boolean;
  /** Error message if stage failed */
  error?: string;
}

/**
 * Result from Claude investigation stage
 */
export interface InvestigationResult extends BaseStageResult {
  /** Enhanced task description with technical details */
  detailedDescription: string;
  /** List of files identified in codebase */
  filesIdentified: string[];
  /** Technical context and analysis */
  technicalContext: string;
  /** Path to the investigation report file */
  investigationFile?: string;
}

/**
 * Result from Gemini analysis stage
 */
export interface AnalysisResult extends BaseStageResult {
  /** Path to the generated feature specification file */
  featureSpecFile: string;
  /** Directory containing feature-related files */
  featureDir?: string;
  /** Content of the feature specification */
  content?: string;
  /** Path to Gemini execution log file */
  logFile?: string;
  /** Path to Gemini progress file */
  progressFile?: string;
  /** Whether fallback analysis was used (Gemini unavailable) */
  fallback?: boolean;
}

/**
 * Result from Claude implementation stage
 */
export interface ImplementationResult extends BaseStageResult {
  /** Git branch where implementation was committed */
  branch?: string;
  /** Path to Claude execution log file */
  logFile?: string;
  /** Path to Claude progress file */
  progressFile?: string;
}

/**
 * Result from Codex code review stage
 */
export interface ReviewResult extends BaseStageResult {
  /** Git branch that was reviewed */
  branch?: string;
  /** Path to review output file */
  reviewFile?: string;
  /** Number of issues found */
  issuesFound?: number;
}

/**
 * Result from Claude fixes stage
 */
export interface FixResult extends BaseStageResult {
  /** Git branch where fixes were applied */
  branch?: string;
  /** Number of TODOs/FIXMEs fixed */
  issuesFixed?: number;
}

// ============================================
// STAGE METADATA
// ============================================

/**
 * Metadata stored for each stage execution
 */
export interface StageMetadata {
  /** When the stage started */
  startedAt: string;
  /** When the stage completed (if completed) */
  completedAt?: string;
  /** Stage status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Additional stage-specific data */
  data?: Record<string, unknown>;
}

// ============================================
// STAGE OPTIONS
// ============================================

/**
 * Options for stage execution
 */
export interface StageOptions {
  /** Repository configuration override */
  repoConfig?: RepositoryConfig;
  /** Skip notification posting */
  skipNotifications?: boolean;
  /** Retry count for failed operations */
  maxRetries?: number;
}
