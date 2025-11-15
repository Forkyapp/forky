/**
 * AI Service Types
 * Types for AI agent interactions (Claude, Gemini, Codex)
 */

import { RepositoryConfig } from './config';

// Common AI types
export interface AIProgress {
  readonly agent: string;
  readonly taskId: string;
  readonly stage: string;
  readonly currentStep: string;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly lastUpdate: string;
}

export interface AIExecutionInfo {
  readonly startedAt: string;
  readonly logFile?: string;
  readonly progressFile?: string;
  readonly [key: string]: unknown;
}

// Claude types
export interface ClaudeSettings {
  readonly permissions: {
    readonly allow: readonly string[];
    readonly deny: readonly string[];
  };
  readonly hooks: {
    readonly [key: string]: string;
  };
}

export interface ClaudeLaunchOptions {
  readonly analysis?: {
    readonly content: string;
    readonly featureDir?: string;
    readonly featureSpecFile?: string;
  };
  readonly subtask?: { id?: string; description?: string } | unknown;
  readonly branch?: string;
  readonly repoConfig?: RepositoryConfig;
}

export interface ClaudeLaunchResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly logFile?: string;
  readonly progressFile?: string;
  readonly error?: string;
}

export interface ClaudeFixTodoOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface ClaudeFixTodoResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

// Gemini types
export interface GeminiAnalyzeTaskOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface GeminiAnalysisResult {
  readonly success: boolean;
  readonly featureSpecFile: string;
  readonly featureDir: string;
  readonly content: string;
  readonly logFile?: string;
  readonly progressFile?: string;
  readonly fallback?: boolean;
  readonly error?: string;
}

export interface GeminiFeatureSpec {
  readonly file: string;
  readonly content: string;
}

// Codex types
export interface CodexReviewOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface CodexReviewResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

export interface CodexLaunchOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface CodexLaunchResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

// Qwen types
export interface QwenWriteTestsOptions {
  readonly repoConfig?: RepositoryConfig;
}

export interface QwenWriteTestsResult {
  readonly success: boolean;
  readonly branch?: string;
  readonly error?: string;
}

// Execution types
export interface ExecWithPTYOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdinFile?: string;
}

export interface ErrorWithCode extends Error {
  code?: string | number;
  stdout?: string;
  stderr?: string;
}

// Backwards compatibility aliases
export type Settings = ClaudeSettings;
export type LaunchOptions = ClaudeLaunchOptions;
export type LaunchResult = ClaudeLaunchResult;
export type FixTodoOptions = ClaudeFixTodoOptions;
export type FixTodoResult = ClaudeFixTodoResult;
export type AnalysisResult = GeminiAnalysisResult;
export type FeatureSpec = GeminiFeatureSpec;
export type Progress = AIProgress;
export type ReviewOptions = CodexReviewOptions;
export type ReviewResult = CodexReviewResult;
