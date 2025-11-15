import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProcessInfo {
  pid?: number;
  registeredAt?: string;
  status?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string | Error;
  [key: string]: unknown;
}

interface ProcessResult {
  completed: boolean;
  timedOut: boolean;
}

interface ProcessWaitResult extends ProcessResult {
  process: ProcessInfo;
}

interface AllProcessesResult {
  allCompleted: boolean;
  anyTimedOut?: boolean;
  results: ProcessWaitResult[];
}

// In-memory process registry
const processes = new Map<string, ProcessInfo[]>();

/**
 * Register a process
 */
function registerProcess(taskId: string, processInfo: ProcessInfo): ProcessInfo {
  if (!processes.has(taskId)) {
    processes.set(taskId, []);
  }

  const entry: ProcessInfo = {
    ...processInfo,
    registeredAt: new Date().toISOString(),
    status: 'running'
  };

  processes.get(taskId)!.push(entry);

  return entry;
}

/**
 * Get all processes for a task
 */
function getProcesses(taskId: string): ProcessInfo[] {
  return processes.get(taskId) || [];
}

/**
 * Check if a process is running (macOS)
 */
async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`ps -p ${pid}`);
    return stdout.includes(String(pid));
  } catch (_error) {
    return false;
  }
}

/**
 * Kill a process
 */
async function killProcess(pid: number): Promise<boolean> {
  try {
    await execAsync(`kill ${pid}`);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Wait for a process to complete
 */
async function waitForProcess(pid: number, timeoutMs: number = 30 * 60 * 1000): Promise<ProcessResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const running = await isProcessRunning(pid);

    if (!running) {
      return { completed: true, timedOut: false };
    }

    // Check every 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return { completed: false, timedOut: true };
}

/**
 * Wait for all processes of a task to complete
 */
async function waitForAllProcesses(taskId: string, timeoutMs: number = 30 * 60 * 1000): Promise<AllProcessesResult> {
  const taskProcesses = getProcesses(taskId);

  if (taskProcesses.length === 0) {
    return { allCompleted: true, results: [] };
  }

  const results = await Promise.all(
    taskProcesses.map(async (proc): Promise<ProcessWaitResult> => {
      if (!proc.pid) {
        return { process: proc, completed: true, timedOut: false };
      }

      const result = await waitForProcess(proc.pid, timeoutMs);

      return {
        process: proc,
        ...result
      };
    })
  );

  const allCompleted = results.every(r => r.completed);
  const anyTimedOut = results.some(r => r.timedOut);

  return {
    allCompleted,
    anyTimedOut,
    results
  };
}

/**
 * Mark process as completed
 */
function markCompleted(taskId: string, processIndex: number): void {
  const taskProcesses = processes.get(taskId);

  if (taskProcesses && taskProcesses[processIndex]) {
    taskProcesses[processIndex].status = 'completed';
    taskProcesses[processIndex].completedAt = new Date().toISOString();
  }
}

/**
 * Mark process as failed
 */
function markFailed(taskId: string, processIndex: number, error: string | Error): void {
  const taskProcesses = processes.get(taskId);

  if (taskProcesses && taskProcesses[processIndex]) {
    taskProcesses[processIndex].status = 'failed';
    taskProcesses[processIndex].failedAt = new Date().toISOString();
    taskProcesses[processIndex].error = error;
  }
}

/**
 * Clean up process registry for completed task
 */
function cleanup(taskId: string): void {
  processes.delete(taskId);
}

/**
 * Clean up all dead processes
 */
async function cleanupDeadProcesses(): Promise<number> {
  let cleaned = 0;

  for (const [, taskProcesses] of processes.entries()) {
    for (let i = taskProcesses.length - 1; i >= 0; i--) {
      const proc = taskProcesses[i];

      if (proc.pid && proc.status === 'running') {
        const running = await isProcessRunning(proc.pid);

        if (!running) {
          taskProcesses[i].status = 'completed';
          taskProcesses[i].completedAt = new Date().toISOString();
          cleaned++;
        }
      }
    }
  }

  return cleaned;
}

export {
  registerProcess,
  getProcesses,
  isProcessRunning,
  killProcess,
  waitForProcess,
  waitForAllProcesses,
  markCompleted,
  markFailed,
  cleanup,
  cleanupDeadProcesses,
  ProcessInfo,
  ProcessResult,
  ProcessWaitResult,
  AllProcessesResult
};
