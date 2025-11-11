/**
 * AI Agent related type definitions
 * Shared across Claude, Codex, and Gemini agents
 */

import { RepositoryConfig } from '../config';

export interface LaunchOptions {
  analysis?: {
    content: string;
    featureDir?: string;
    featureSpecFile?: string;
  };
  subtask?: any;
  branch?: string;
  repoConfig?: RepositoryConfig;
}

export interface LaunchResult {
  success: boolean;
  branch?: string;
  logFile?: string;
  progressFile?: string;
  error?: string;
}

export interface ReviewOptions {
  repoConfig?: RepositoryConfig;
}

export interface ReviewResult {
  success: boolean;
  branch?: string;
  error?: string;
}

export interface FixTodoOptions {
  repoConfig?: RepositoryConfig;
}

export interface FixTodoResult {
  success: boolean;
  branch?: string;
  error?: string;
}

export interface Settings {
  permissions: {
    allow: string[];
    deny: string[];
  };
  hooks: {
    [key: string]: string;
  };
}

export interface AnalysisResult {
  success: boolean;
  featureSpecFile: string;
  featureDir: string;
  content: string;
  logFile?: string;
  progressFile?: string;
  fallback?: boolean;
  error?: string;
}

export interface FeatureSpec {
  file: string;
  content: string;
}

export interface Progress {
  agent: string;
  taskId: string;
  stage: string;
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  lastUpdate: string;
}
