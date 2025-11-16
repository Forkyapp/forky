import { ChildProcess, spawn, type SpawnOptions } from 'child_process';
import { timmy } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';

/**
 * ProcessManager - Tracks and manages child processes
 *
 * This utility ensures all spawned processes are properly cleaned up
 * when Timmy shuts down, preventing orphaned background processes.
 */
export class ProcessManager {
  private static instance: ProcessManager | null = null;
  private processes: Map<string, ChildProcess> = new Map();
  private shutdownHandlersRegistered = false;

  private constructor() {
    this.registerShutdownHandlers();
  }

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  /**
   * Register a process for tracking
   *
   * @param id - Unique identifier for the process
   * @param process - Child process to track
   */
  register(id: string, process: ChildProcess): void {
    this.processes.set(id, process);
    logger.info('Process registered', { id, pid: process.pid });

    // Auto-cleanup when process exits
    process.on('exit', (code) => {
      logger.info('Process exited', { id, pid: process.pid, code });
      this.processes.delete(id);
    });
  }

  /**
   * Unregister a process
   *
   * @param id - Process identifier
   */
  unregister(id: string): void {
    this.processes.delete(id);
    logger.info('Process unregistered', { id });
  }

  /**
   * Kill a specific process
   *
   * @param id - Process identifier
   * @param signal - Signal to send (default: SIGTERM)
   */
  kill(id: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const process = this.processes.get(id);
    if (process && !process.killed) {
      logger.info('Killing process', { id, pid: process.pid, signal });
      process.kill(signal);
      this.processes.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Kill all tracked processes
   *
   * @param signal - Signal to send (default: SIGTERM)
   */
  killAll(signal: NodeJS.Signals = 'SIGTERM'): void {
    console.log(timmy.warning(`Terminating ${this.processes.size} active process(es)...`));

    for (const [id, process] of this.processes.entries()) {
      if (!process.killed) {
        logger.info('Killing process', { id, pid: process.pid, signal });
        process.kill(signal);
      }
    }

    this.processes.clear();
  }

  /**
   * Get process by ID
   *
   * @param id - Process identifier
   * @returns Child process or undefined
   */
  get(id: string): ChildProcess | undefined {
    return this.processes.get(id);
  }

  /**
   * Check if a process is running
   *
   * @param id - Process identifier
   * @returns True if process is running
   */
  isRunning(id: string): boolean {
    const process = this.processes.get(id);
    return !!process && !process.killed;
  }

  /**
   * Get count of active processes
   *
   * @returns Number of active processes
   */
  getActiveCount(): number {
    return this.processes.size;
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  private registerShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) {
      return;
    }

    const shutdown = (signal: string) => {
      console.log(timmy.warning(`\nReceived ${signal} - shutting down gracefully...`));
      this.killAll('SIGTERM');

      // Give processes 5 seconds to terminate gracefully
      setTimeout(() => {
        if (this.processes.size > 0) {
          console.log(timmy.error('Force killing remaining processes...'));
          this.killAll('SIGKILL');
        }
        process.exit(0);
      }, 5000);
    };

    // Register handlers for common termination signals
    process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
    process.on('SIGTERM', () => shutdown('SIGTERM')); // kill command
    process.on('SIGQUIT', () => shutdown('SIGQUIT')); // Ctrl+\

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.log(timmy.error(`Uncaught exception: ${error.message}`));
      logger.error('Uncaught exception', error);
      this.killAll('SIGTERM');
      process.exit(1);
    });

    this.shutdownHandlersRegistered = true;
    logger.info('Shutdown handlers registered');
  }

  /**
   * Spawn a command and automatically track the process
   *
   * @param id - Unique identifier for this process
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Spawn options
   * @returns Child process
   */
  spawn(
    id: string,
    command: string,
    args: string[] = [],
    options: SpawnOptions = {}
  ): ChildProcess {
    const child = spawn(command, args, {
      ...options,
      shell: true
    });

    this.register(id, child);

    return child;
  }
}

/**
 * Get the singleton ProcessManager instance
 */
export function getProcessManager(): ProcessManager {
  return ProcessManager.getInstance();
}

/**
 * Helper to spawn a tracked process
 */
export function spawnTracked(
  id: string,
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): ChildProcess {
  return getProcessManager().spawn(id, command, args, options);
}
