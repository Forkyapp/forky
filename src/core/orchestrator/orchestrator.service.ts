/**
 * Orchestrator Service - Main workflow orchestration (Legacy Wrapper)
 *
 * ⚠️ REFACTORED: This file now delegates to the new refactored workflow system
 *
 * The core orchestration logic has been refactored into:
 * - src/core/workflow/ - Main workflow orchestration
 * - src/core/stages/ - Individual pipeline stages
 * - src/core/notifications/ - Notification system
 *
 * This file maintains backward compatibility by delegating to the new modules.
 * New code should import directly from src/core/workflow/ instead.
 *
 * @deprecated Use src/core/workflow/ directly for new code
 */

import { taskOrchestrator } from '../workflow';
import * as storage from '../../../lib/storage';
import type { ClickUpTask } from '../../../lib/clickup';

// Re-export types for backward compatibility
export type { ProcessTaskResult, RerunResult, WorkflowOptions } from '../workflow/types';
export type { StageContext, AnalysisResult, ImplementationResult, ReviewResult, FixResult } from '../stages/types';

/**
 * Process a task with FULLY SYNCHRONOUS multi-AI workflow
 *
 * Flow: Gemini Analysis → Claude Implementation → Codex Review → Claude Fixes → Complete
 * All agents run in sequence, waiting for each to complete before starting the next
 *
 * @param task The ClickUp task to process
 * @returns Process result with success status and pipeline data
 */
export async function processTask(task: ClickUpTask) {
  return taskOrchestrator.processTask(task);
}

/**
 * Get pipeline status for a task
 *
 * @param taskId The task ID to get status for
 * @returns Pipeline summary or null if not found
 */
export function getTaskStatus(taskId: string): storage.PipelineSummary | null {
  return taskOrchestrator.getTaskStatus(taskId);
}

/**
 * Get all active tasks
 *
 * @returns Array of active pipeline data
 */
export function getActiveTasks(): storage.PipelineData[] {
  return taskOrchestrator.getActiveTasks();
}

/**
 * Re-run only the Codex review stage
 *
 * @param taskId The task ID to rerun review for
 * @returns Rerun result with success status
 */
export async function rerunCodexReview(taskId: string) {
  return taskOrchestrator.rerunCodexReview(taskId);
}

/**
 * Re-run only the Claude fixes stage
 *
 * @param taskId The task ID to rerun fixes for
 * @returns Rerun result with success status
 */
export async function rerunClaudeFixes(taskId: string) {
  return taskOrchestrator.rerunClaudeFixes(taskId);
}
