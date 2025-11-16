import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';
import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';

const execAsync = promisify(exec);

export interface WorktreeInfo {
  taskId: string;
  path: string;
  branch: string;
  createdAt: Date;
}

export interface CreateWorktreeOptions {
  taskId: string;
  baseBranch?: string;
  repoPath: string;
}

export interface RemoveWorktreeOptions {
  taskId: string;
  repoPath: string;
  force?: boolean;
}

/**
 * WorktreeManager - Manages Git worktrees for isolated bot task execution
 *
 * This service creates separate working directories for each bot task,
 * allowing the user to continue working in their main repository without
 * interference from the bot's git operations.
 *
 * Architecture:
 * - Main repo: User's working directory (untouched by bot)
 * - Worktrees: Separate directories for each bot task
 * - Location: REPO_PATH/../.timmy-worktrees/task-{taskId}
 */
export class WorktreeManager {
  private worktreesBaseDir: string;
  private activeWorktrees: Map<string, WorktreeInfo> = new Map();

  constructor(repoPath: string) {
    // Store worktrees one level up from the main repo
    const repoParent = path.dirname(repoPath);
    this.worktreesBaseDir = path.join(repoParent, '.timmy-worktrees');
  }

  /**
   * Create a new worktree for a task
   *
   * @param options - Worktree creation options
   * @returns Path to the created worktree
   */
  async createWorktree(options: CreateWorktreeOptions): Promise<string> {
    const { taskId, baseBranch = 'main', repoPath } = options;
    const branchName = `task-${taskId}`;
    const worktreePath = path.join(this.worktreesBaseDir, branchName);

    try {
      console.log(timmy.info(`Creating isolated worktree for ${colors.bright}${taskId}${colors.reset}...`));

      // Ensure worktrees base directory exists
      await fs.mkdir(this.worktreesBaseDir, { recursive: true });

      // Check if worktree already exists
      if (await this.worktreeExists(worktreePath)) {
        console.log(timmy.warning(`Worktree already exists for ${taskId}, cleaning up...`));
        await this.removeWorktree({ taskId, repoPath, force: true });
      }

      // Fetch latest changes from remote
      console.log(timmy.info('Fetching latest changes...'));
      await execAsync(`cd "${repoPath}" && git fetch origin ${baseBranch}`, {
        timeout: 60000
      });

      // Check if branch already exists remotely or locally
      const branchExists = await this.branchExists(repoPath, branchName);

      if (branchExists) {
        // Branch exists, create worktree and checkout existing branch
        console.log(timmy.info(`Branch ${branchName} exists, checking out in worktree...`));
        await execAsync(
          `cd "${repoPath}" && git worktree add "${worktreePath}" ${branchName}`,
          { timeout: 60000 }
        );
      } else {
        // Create new branch in worktree
        console.log(timmy.info(`Creating new branch ${branchName} in worktree...`));
        await execAsync(
          `cd "${repoPath}" && git worktree add -b ${branchName} "${worktreePath}" origin/${baseBranch}`,
          { timeout: 60000 }
        );
      }

      // Track this worktree
      this.activeWorktrees.set(taskId, {
        taskId,
        path: worktreePath,
        branch: branchName,
        createdAt: new Date()
      });

      console.log(timmy.success(`✓ Worktree created at ${colors.dim}${worktreePath}${colors.reset}`));
      logger.info('Worktree created', { taskId, path: worktreePath, branch: branchName });

      return worktreePath;

    } catch (error) {
      const err = error as Error;
      console.log(timmy.error(`Failed to create worktree: ${err.message}`));
      logger.error('Worktree creation failed', err, { taskId });
      throw new Error(`Failed to create worktree for task ${taskId}: ${err.message}`);
    }
  }

  /**
   * Remove a worktree and optionally delete the branch
   *
   * @param options - Worktree removal options
   */
  async removeWorktree(options: RemoveWorktreeOptions): Promise<void> {
    const { taskId, repoPath, force = false } = options;
    const branchName = `task-${taskId}`;
    const worktreePath = path.join(this.worktreesBaseDir, branchName);

    try {
      console.log(timmy.info(`Removing worktree for ${colors.bright}${taskId}${colors.reset}...`));

      // Check if worktree exists
      const exists = await this.worktreeExists(worktreePath);

      if (!exists) {
        console.log(timmy.warning(`Worktree for ${taskId} not found, may already be removed`));
        this.activeWorktrees.delete(taskId);
        return;
      }

      // Remove worktree
      const forceFlag = force ? '--force' : '';
      await execAsync(
        `cd "${repoPath}" && git worktree remove ${forceFlag} "${worktreePath}"`,
        { timeout: 30000 }
      );

      // Remove from tracking
      this.activeWorktrees.delete(taskId);

      console.log(timmy.success(`✓ Worktree removed for ${taskId}`));
      logger.info('Worktree removed', { taskId, path: worktreePath });

    } catch (error) {
      const err = error as Error;
      console.log(timmy.error(`Failed to remove worktree: ${err.message}`));
      logger.error('Worktree removal failed', err, { taskId });

      // Try force removal if initial removal failed
      if (!force) {
        console.log(timmy.warning('Attempting force removal...'));
        await this.removeWorktree({ taskId, repoPath, force: true });
      } else {
        throw new Error(`Failed to remove worktree for task ${taskId}: ${err.message}`);
      }
    }
  }

  /**
   * Get the path to a task's worktree
   *
   * @param taskId - Task ID
   * @returns Worktree path
   */
  getWorktreePath(taskId: string): string {
    const worktree = this.activeWorktrees.get(taskId);
    if (worktree) {
      return worktree.path;
    }

    // Return expected path even if not tracked
    const branchName = `task-${taskId}`;
    return path.join(this.worktreesBaseDir, branchName);
  }

  /**
   * List all active worktrees for this repository
   *
   * @param repoPath - Repository path
   * @returns List of worktree information
   */
  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync(
        `cd "${repoPath}" && git worktree list --porcelain`,
        { timeout: 10000 }
      );

      const worktrees: WorktreeInfo[] = [];
      const lines = stdout.split('\n');
      let currentWorktree: Partial<WorktreeInfo> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          const worktreePath = line.replace('worktree ', '');

          // Only include Timmy worktrees
          if (worktreePath.includes('.timmy-worktrees')) {
            currentWorktree.path = worktreePath;

            // Extract task ID from path
            const match = worktreePath.match(/task-([^/]+)$/);
            if (match) {
              currentWorktree.taskId = match[1];
            }
          }
        } else if (line.startsWith('branch ') && currentWorktree.path) {
          currentWorktree.branch = line.replace('branch refs/heads/', '');
        } else if (line === '' && currentWorktree.path && currentWorktree.branch) {
          worktrees.push({
            taskId: currentWorktree.taskId || 'unknown',
            path: currentWorktree.path,
            branch: currentWorktree.branch,
            createdAt: new Date() // We don't track creation time from git
          });
          currentWorktree = {};
        }
      }

      return worktrees;

    } catch (error) {
      const err = error as Error;
      logger.error('Failed to list worktrees', err);
      return [];
    }
  }

  /**
   * Clean up stale worktrees (older than specified hours)
   *
   * @param repoPath - Repository path
   * @param olderThanHours - Remove worktrees older than this many hours (default: 24)
   */
  async cleanupStaleWorktrees(repoPath: string, olderThanHours: number = 24): Promise<void> {
    try {
      console.log(timmy.info(`Cleaning up stale worktrees (older than ${olderThanHours}h)...`));

      const worktrees = await this.listWorktrees(repoPath);
      const now = Date.now();
      const cutoffTime = olderThanHours * 60 * 60 * 1000; // Convert to milliseconds

      for (const worktree of worktrees) {
        const age = now - worktree.createdAt.getTime();

        if (age > cutoffTime) {
          console.log(timmy.warning(`Removing stale worktree: ${worktree.branch}`));
          await this.removeWorktree({
            taskId: worktree.taskId,
            repoPath,
            force: true
          });
        }
      }

      console.log(timmy.success('✓ Stale worktrees cleaned up'));

    } catch (error) {
      const err = error as Error;
      console.log(timmy.error(`Failed to clean up stale worktrees: ${err.message}`));
      logger.error('Stale worktree cleanup failed', err);
    }
  }

  /**
   * Check if a worktree exists at the given path
   *
   * @param worktreePath - Path to check
   * @returns True if worktree exists
   */
  private async worktreeExists(worktreePath: string): Promise<boolean> {
    try {
      await fs.access(worktreePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a branch exists (locally or remotely)
   *
   * @param repoPath - Repository path
   * @param branchName - Branch name to check
   * @returns True if branch exists
   */
  private async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    try {
      // Check local branches
      await execAsync(
        `cd "${repoPath}" && git rev-parse --verify ${branchName}`,
        { timeout: 5000 }
      );
      return true;
    } catch {
      try {
        // Check remote branches
        await execAsync(
          `cd "${repoPath}" && git rev-parse --verify origin/${branchName}`,
          { timeout: 5000 }
        );
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get information about an active worktree
   *
   * @param taskId - Task ID
   * @returns Worktree information or null if not found
   */
  getWorktreeInfo(taskId: string): WorktreeInfo | null {
    return this.activeWorktrees.get(taskId) || null;
  }

  /**
   * Check if a worktree is active for a task
   *
   * @param taskId - Task ID
   * @returns True if worktree exists
   */
  hasWorktree(taskId: string): boolean {
    return this.activeWorktrees.has(taskId);
  }
}

/**
 * Create a singleton instance for the configured repository
 */
let worktreeManagerInstance: WorktreeManager | null = null;

export function getWorktreeManager(repoPath: string): WorktreeManager {
  if (!worktreeManagerInstance) {
    worktreeManagerInstance = new WorktreeManager(repoPath);
  }
  return worktreeManagerInstance;
}

export function resetWorktreeManager(): void {
  worktreeManagerInstance = null;
}
