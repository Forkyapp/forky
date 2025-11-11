import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { colors } from '../../shared/ui';

const execAsync = promisify(exec);

interface Progress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  lastUpdate: string;
}

interface AgentStatus {
  agent: string;
  taskId: string;
  running: boolean;
  pid: number | null;
  progress: Progress | null;
  lastLogs: string[];
  error: string | null;
}

interface AgentInfo {
  pidFile?: string | null;
  logFile?: string | null;
}

/**
 * Check if a process is running
 * @param pid - Process ID
 * @returns True if running
 */
async function isProcessRunning(pid: number | null): Promise<boolean> {
  if (!pid) return false;

  try {
    // Check if process exists
    await execAsync(`ps -p ${pid}`, { timeout: 2000 });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Read progress file
 * @param taskId - Task ID
 * @param agent - Agent name (gemini, claude, codex)
 * @returns Progress data or null
 */
function readProgress(taskId: string, agent: string): Progress | null {
  const progressFile = path.join(__dirname, '..', 'progress', `${taskId}-${agent}.json`);

  if (!fs.existsSync(progressFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(progressFile, 'utf8');
    return JSON.parse(content) as Progress;
  } catch (_error) {
    return null;
  }
}

/**
 * Read last N lines from log file
 * @param logFile - Path to log file
 * @param lines - Number of lines to read
 * @returns Array of log lines
 */
async function tailLogFile(logFile: string, lines: number = 5): Promise<string[]> {
  if (!fs.existsSync(logFile)) {
    return [];
  }

  try {
    const { stdout } = await execAsync(`tail -n ${lines} "${logFile}"`, { timeout: 2000 });
    return stdout.trim().split('\n').filter(line => line.trim());
  } catch (_error) {
    return [];
  }
}

/**
 * Get status of an agent
 * @param taskId - Task ID
 * @param agent - Agent name (gemini, claude, codex)
 * @param pidFile - Path to PID file
 * @param logFile - Path to log file
 * @returns Status object
 */
async function getAgentStatus(
  taskId: string,
  agent: string,
  pidFile: string | null | undefined,
  logFile: string | null | undefined
): Promise<AgentStatus> {
  const status: AgentStatus = {
    agent,
    taskId,
    running: false,
    pid: null,
    progress: null,
    lastLogs: [],
    error: null
  };

  // Read PID
  if (pidFile && fs.existsSync(pidFile)) {
    try {
      status.pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      status.running = await isProcessRunning(status.pid);
    } catch (_error) {
      status.error = 'Failed to read PID file';
    }
  }

  // Read progress
  status.progress = readProgress(taskId, agent);

  // Read last log lines
  if (logFile) {
    status.lastLogs = await tailLogFile(logFile, 3);
  }

  return status;
}

/**
 * Format progress bar
 * @param completed - Completed steps
 * @param total - Total steps
 * @param width - Bar width (default 16)
 * @returns Progress bar string
 */
function formatProgressBar(completed: number, total: number, width: number = 16): string {
  if (!total || total === 0) return '░'.repeat(width);

  const percentage = Math.min(100, Math.max(0, (completed / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(percentage)}%`;
}

/**
 * Format time duration
 * @param startTime - ISO timestamp
 * @returns Formatted duration
 */
function formatDuration(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diff = now.getTime() - start.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Display agent status in console
 * @param status - Status object from getAgentStatus
 */
function displayAgentStatus(status: AgentStatus): void {
  const { agent, taskId, running, pid, progress, lastLogs } = status;

  // Agent name with color
  const agentName = agent.charAt(0).toUpperCase() + agent.slice(1);
  const agentColor = agent === 'gemini' ? colors.cyan : agent === 'claude' ? colors.blue : colors.magenta;

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`${agentColor}${agentName}${colors.reset} ${colors.bright}${taskId}${colors.reset}`);

  // Status
  if (running) {
    console.log(`${colors.green}●${colors.reset} Running ${pid ? `(PID: ${pid})` : ''}`);
  } else if (pid) {
    console.log(`${colors.red}●${colors.reset} Stopped ${pid ? `(PID: ${pid})` : ''}`);
  } else {
    console.log(`${colors.yellow}●${colors.reset} Starting...`);
  }

  // Progress
  if (progress) {
    const { currentStep, completedSteps, totalSteps, lastUpdate } = progress;

    console.log(`\n📝 ${currentStep}`);

    if (totalSteps) {
      console.log(`📊 ${formatProgressBar(completedSteps, totalSteps)}`);
    }

    if (lastUpdate) {
      console.log(`⏱️  ${formatDuration(lastUpdate)}`);
    }
  }

  // Recent logs
  if (lastLogs && lastLogs.length > 0) {
    console.log(`\n📋 Recent activity:`);
    lastLogs.forEach(line => {
      const truncated = line.length > 80 ? line.substring(0, 77) + '...' : line;
      console.log(`   ${colors.dim}${truncated}${colors.reset}`);
    });
  }

  console.log(`${'━'.repeat(60)}`);
}

/**
 * Monitor all active agents for a task
 * @param taskId - Task ID
 * @param agentInfo - Info about running agents {agent: {pidFile, logFile}}
 */
async function monitorTask(taskId: string, agentInfo: Record<string, AgentInfo>): Promise<AgentStatus[]> {
  const statuses: AgentStatus[] = [];

  for (const [agent, info] of Object.entries(agentInfo)) {
    const status = await getAgentStatus(taskId, agent, info.pidFile, info.logFile);
    statuses.push(status);
    displayAgentStatus(status);
  }

  return statuses;
}

export {
  isProcessRunning,
  readProgress,
  tailLogFile,
  getAgentStatus,
  formatProgressBar,
  formatDuration,
  displayAgentStatus,
  monitorTask,
  Progress,
  AgentStatus,
  AgentInfo
};
