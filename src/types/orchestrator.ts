/**
 * Orchestrator Types
 * Types for multi-AI workflow orchestration
 */

import type { GeminiAnalysisResult } from './ai';
import type { PipelineData } from './storage';

export interface ProcessTaskResult {
  readonly success: boolean;
  readonly pipeline?: PipelineData;
  readonly analysis?: GeminiAnalysisResult | null;
  readonly error?: string;
}

export interface RerunCodexReviewOptions {
  readonly taskId: string;
}

export interface RerunCodexReviewResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

export interface RerunClaudeFixesOptions {
  readonly taskId: string;
}

export interface RerunClaudeFixesResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}
