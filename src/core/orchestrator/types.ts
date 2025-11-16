import type { ClickUpTask } from '@/types';
import type { PipelineData } from '@/types/storage';
import { RepositoryConfig } from '@/shared/config';

// ============================================
// RESULT TYPES
// ============================================

export interface AnalysisResult {
  success?: boolean;
  featureSpecFile: string;
  featureDir?: string;
  content?: string;
  logFile?: string;
  progressFile?: string;
  fallback?: boolean;
  error?: string;
}

export interface ImplementationResult {
  success: boolean;
  branch?: string;
  logFile?: string;
  progressFile?: string;
  error?: string;
}

export interface ReviewResult {
  success: boolean;
  branch?: string;
  error?: string;
}

export interface FixResult {
  success: boolean;
  branch?: string;
  error?: string;
}

export interface ProcessTaskResult {
  success: boolean;
  pipeline?: PipelineData;
  analysis?: AnalysisResult | null;
  error?: string;
}

export interface RerunResult {
  success: boolean;
  branch?: string;
  error?: string;
}

// ============================================
// CONTEXT TYPES
// ============================================

export interface StageContext {
  task: ClickUpTask;
  taskId: string;
  taskName: string;
  repoConfig: RepositoryConfig;
}

export interface AnalysisContext extends StageContext {
  analysis?: AnalysisResult | null;
}

// ============================================
// OPTIONS TYPES
// ============================================

export interface ProcessOptions {
  repoConfig?: RepositoryConfig;
}

export interface RerunOptions {
  repoConfig?: RepositoryConfig;
}
