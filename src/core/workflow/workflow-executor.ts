/**
 * Workflow Executor - Executes workflow stages in sequence
 *
 * This class handles the sequential execution of pipeline stages,
 * managing stage transitions and error handling.
 */

import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';
import { resolveRepoConfig } from '@/shared/config';
import { promptStageFailure } from '@/shared/utils/stage-prompt.util';
import { getWorktreeManager } from '../workspace/worktree-manager.service';
import type { ClickUpTask } from '@/types/clickup';
import type { RepositoryConfig } from '@/shared/config';
import {
  AnalysisStage,
  ImplementationStage,
  ReviewStage,
  FixesStage,
  type AnalysisResult,
  type StageContext,
  type ImplementationStageContext,
} from '../stages';
import type { ProcessTaskResult, WorkflowOptions } from './types';

/**
 * Workflow Executor
 *
 * Executes tasks through the multi-stage AI pipeline
 */
export class WorkflowExecutor {
  private readonly analysisStage: AnalysisStage;
  private readonly implementationStage: ImplementationStage;
  private readonly reviewStage: ReviewStage;
  private readonly fixesStage: FixesStage;

  constructor() {
    // Initialize all stages
    this.analysisStage = new AnalysisStage();
    this.implementationStage = new ImplementationStage();
    this.reviewStage = new ReviewStage();
    this.fixesStage = new FixesStage();
  }

  /**
   * Execute the full workflow for a task
   *
   * @param task The ClickUp task to process
   * @param options Workflow execution options
   * @returns Process result
   */
  async execute(task: ClickUpTask, options: WorkflowOptions = {}): Promise<ProcessTaskResult> {
    const taskId = task.id;
    const taskName = task.name;

    console.log(timmy.ai(`Starting multi-AI workflow for ${colors.bright}${taskId}${colors.reset}`));
    logger.info('Workflow started', { taskId, taskName });

    let repoConfig: RepositoryConfig;
    let analysis: AnalysisResult | null = null;
    let worktreePath: string | undefined;
    let worktreeManager: ReturnType<typeof getWorktreeManager> | null = null;

    try {
      // Resolve repository configuration
      repoConfig = resolveRepoConfig();
      console.log(timmy.info(`Using repository: ${repoConfig.owner}/${repoConfig.repo}`));

      // Create isolated worktree for this task
      // This prevents the bot from interfering with the user's working directory
      try {
        console.log(timmy.info('Creating isolated worktree for bot execution...'));
        worktreeManager = getWorktreeManager(repoConfig.path);
        worktreePath = await worktreeManager.createWorktree({
          taskId,
          baseBranch: repoConfig.baseBranch || 'main',
          repoPath: repoConfig.path,
        });
        console.log(timmy.success(`Worktree created: ${colors.dim}${worktreePath}${colors.reset}`));
        logger.info('Worktree created for task', { taskId, worktreePath });
      } catch (error) {
        const err = error as Error;
        console.log(timmy.warning(`Failed to create worktree: ${err.message}`));
        console.log(timmy.info('Continuing without worktree (will use main repository)'));
        logger.warn('Worktree creation failed, using main repo', { taskId, error: err.message });
        worktreePath = undefined;
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to resolve repository configuration', err, { taskId });
      return {
        success: false,
        error: `Repository configuration error: ${err.message}`,
      };
    }

    // Create base stage context (includes worktree path if available)
    const baseContext: StageContext = {
      task,
      taskId,
      taskName,
      repoConfig,
      worktreePath, // Pass worktree path to all stages
    };

    try {
      // Stage 1: Gemini Analysis
      if (!this.shouldSkipStage('analysis', options)) {
        analysis = await this.runStageWithRetry(
          'analysis',
          async () => {
            console.log(timmy.info('Stage 1: Gemini Analysis'));
            return await this.analysisStage.run(baseContext);
          }
        );
      }

      // Stage 2: Claude Implementation (CRITICAL)
      if (!this.shouldSkipStage('implementation', options)) {
        const implResult = await this.runStageWithRetry(
          'implementation',
          async () => {
            console.log(timmy.info('Stage 2: Claude Implementation'));
            const implContext: ImplementationStageContext = {
              ...baseContext,
              analysis,
            };
            return await this.implementationStage.run(implContext);
          }
        );

        // Implementation must succeed - if we get here it succeeded
        if (!implResult || !implResult.success) {
          throw new Error('Implementation failed critically');
        }
      }

      // Stage 3: Codex Review
      if (!this.shouldSkipStage('review', options)) {
        await this.runStageWithRetry(
          'review',
          async () => {
            console.log(timmy.info('Stage 3: Codex Code Review'));
            return await this.reviewStage.run(baseContext);
          }
        );
      }

      // Stage 4: Claude Fixes
      if (!this.shouldSkipStage('fixes', options)) {
        await this.runStageWithRetry(
          'fixes',
          async () => {
            console.log(timmy.info('Stage 4: Claude Fixes'));
            return await this.fixesStage.run(baseContext);
          }
        );
      }

      console.log(
        timmy.success(`🎉 Multi-AI workflow complete for ${colors.bright}${taskId}${colors.reset}`)
      );

      logger.info('Workflow completed successfully', { taskId });

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Workflow failed', err, { taskId, stage: 'execution' });

      return {
        success: false,
        error: err.message,
      };
    } finally {
      // Clean up worktree (success or failure)
      if (worktreePath && worktreeManager) {
        try {
          console.log(timmy.info('Cleaning up worktree...'));
          await worktreeManager.removeWorktree({
            taskId,
            repoPath: repoConfig.path,
            force: true, // Force removal even if there are uncommitted changes
          });
          console.log(timmy.success('Worktree cleaned up'));
          logger.info('Worktree removed', { taskId, worktreePath });
        } catch (error) {
          const err = error as Error;
          console.log(timmy.warning(`Failed to clean up worktree: ${err.message}`));
          logger.warn('Worktree cleanup failed', { taskId, error: err.message });
          // Don't fail the whole workflow if cleanup fails
        }
      }
    }
  }

  /**
   * Check if a stage should be skipped
   */
  private shouldSkipStage(stageName: string, options: WorkflowOptions): boolean {
    return options.skipStages?.includes(stageName) || false;
  }

  /**
   * Run a stage with automatic retry/skip/abort prompts on failure
   *
   * @param stageName - Name of the stage (e.g., 'analysis', 'implementation')
   * @param stageRunner - Function that executes the stage
   * @returns Stage result or null if skipped
   */
  private async runStageWithRetry<T extends { success: boolean; error?: string }>(
    stageName: string,
    stageRunner: () => Promise<T>
  ): Promise<T | null> {
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite retry loops

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const result = await stageRunner();

        if (result.success) {
          return result; // Success - return result
        }

        // Stage failed - prompt user
        const errorMsg = result.error || 'Stage failed with unknown error';
        const { action } = await promptStageFailure(stageName, errorMsg);

        if (action === 'retry') {
          logger.info(`User chose to retry ${stageName}`, { attempt: attempts });
          continue; // Retry the stage
        } else if (action === 'skip') {
          logger.warn(`User chose to skip ${stageName}`, { attempt: attempts });
          return null; // Skipped
        } else if (action === 'abort') {
          logger.error(`User chose to abort at ${stageName}`, undefined, { attempt: attempts });
          throw new Error(`Workflow aborted by user at stage: ${stageName}`);
        }
      } catch (error) {
        // Caught an exception during execution
        const err = error as Error;

        // If this is an abort, re-throw immediately
        if (err.message.includes('aborted by user')) {
          throw err;
        }

        // Otherwise, prompt user
        const { action } = await promptStageFailure(stageName, err.message);

        if (action === 'retry') {
          logger.info(`User chose to retry ${stageName} after exception`, { attempt: attempts });
          continue;
        } else if (action === 'skip') {
          logger.warn(`User chose to skip ${stageName} after exception`, { attempt: attempts });
          return null;
        } else if (action === 'abort') {
          logger.error(`User chose to abort at ${stageName} after exception`, err, { attempt: attempts });
          throw new Error(`Workflow aborted by user at stage: ${stageName}`);
        }
      }
    }

    // Max attempts reached
    throw new Error(`Stage ${stageName} failed after ${maxAttempts} attempts`);
  }
}
