/**
 * Common type definitions used across multiple modules
 */

export interface ErrorWithCode extends Error {
  code?: number | string;
  response?: {
    status: number;
  };
  stdout?: string;
  stderr?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface ExecWithPTYOptions {
  stdinFile?: string;
  shell?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProcessInfo {
  pid?: number;
  registeredAt?: string;
  status?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string | Error;
  [key: string]: any;
}

export interface ProcessResult {
  completed: boolean;
  timedOut: boolean;
}

export interface ProcessWaitResult extends ProcessResult {
  process: ProcessInfo;
}

export interface AllProcessesResult {
  allCompleted: boolean;
  anyTimedOut?: boolean;
  results: ProcessWaitResult[];
}
