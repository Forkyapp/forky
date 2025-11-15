/**
 * Workflow Types - Type definitions for workflow orchestration
 */

import type { PipelineData } from '../../../lib/storage';
import type { AnalysisResult } from '../stages/types';

/**
 * Result from processing a task through the workflow
 */
export interface ProcessTaskResult {
  /** Whether the workflow succeeded */
  success: boolean;
  /** Pipeline state data */
  pipeline?: PipelineData;
  /** Analysis result (if analysis stage completed) */
  analysis?: AnalysisResult | null;
  /** Error message if workflow failed */
  error?: string;
}

/**
 * Result from rerunning a specific stage
 */
export interface RerunResult {
  /** Whether the rerun succeeded */
  success: boolean;
  /** Branch that was processed */
  branch?: string;
  /** Error message if rerun failed */
  error?: string;
}

/**
 * Workflow execution options
 */
export interface WorkflowOptions {
  /** Skip specific stages */
  skipStages?: string[];
  /** Enable/disable notifications */
  enableNotifications?: boolean;
  /** Maximum retry attempts per stage */
  maxRetries?: number;
}

/**
 * Workflow stage configuration
 */
export interface StageConfig {
  /** Stage name */
  name: string;
  /** Whether the stage is critical (failure stops workflow) */
  critical: boolean;
  /** Whether to skip this stage */
  skip?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}
