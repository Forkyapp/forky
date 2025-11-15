/**
 * Task Orchestrator - Main workflow orchestration entry point
 *
 * This is the simplified main orchestrator that coordinates the workflow
 * execution, pipeline management, and notifications.
 *
 * Responsibilities:
 * - Initialize pipeline state
 * - Coordinate workflow execution
 * - Manage notifications
 * - Handle workflow completion/failure
 */

import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';
import { resolveRepoConfig } from '@/shared/config';
import * as storage from '../../../lib/storage';
import * as clickup from '../../../lib/clickup';
import type { ClickUpTask } from '../../../lib/clickup';
import { WorkflowExecutor } from './workflow-executor';
import { notificationManager } from '../notifications';
import { ReviewStage, FixesStage } from '../stages';
import type { ProcessTaskResult, RerunResult } from './types';

/**
 * Task Orchestrator
 *
 * Main entry point for task processing workflow
 */
export class TaskOrchestrator {
  private readonly executor: WorkflowExecutor;
  private readonly reviewStage: ReviewStage;
  private readonly fixesStage: FixesStage;

  constructor() {
    this.executor = new WorkflowExecutor();
    this.reviewStage = new ReviewStage();
    this.fixesStage = new FixesStage();
  }

  /**
   * Process a task through the full multi-AI workflow
   *
   * @param task The ClickUp task to process
   * @returns Process result
   */
  async processTask(task: ClickUpTask): Promise<ProcessTaskResult> {
    const taskId = task.id;
    const taskName = task.name;

    // Detect repository from task
    const repoName = clickup.detectRepository(task);

    // Initialize pipeline
    const pipelineState = storage.pipeline.init(taskId, { name: taskName });
    storage.pipeline.updateMetadata(taskId, {
      repository: repoName || 'default',
    });

    try {
      // Validate repository configuration
      let repoConfig;
      try {
        repoConfig = resolveRepoConfig();
        if (repoName && repoName !== repoConfig.repo) {
          console.log(
            timmy.warning(
              `Task specifies repo "${repoName}" but active project is "${repoConfig.repo}"`
            )
          );
          console.log(timmy.info('Using active project from workspace.json'));
        }
      } catch (error) {
        const err = error as Error;
        console.log(timmy.error(`Repository setup failed: ${err.message}`));
        storage.pipeline.fail(taskId, err);
        await storage.queue.add(task);
        return {
          success: false,
          error: err.message,
        };
      }

      // Execute workflow
      const result = await this.executor.execute(task);

      if (result.success) {
        // Complete pipeline
        storage.pipeline.complete(taskId, {
          branch: `task-${taskId}`,
          completedAt: new Date().toISOString(),
        });

        // Send completion notification
        await notificationManager.notifyWorkflowComplete({
          taskId,
          status: 'completed',
          branch: `task-${taskId}`,
        });

        return {
          ...result,
          pipeline: pipelineState,
        };
      } else {
        // Fail pipeline
        const error = new Error(result.error || 'Workflow failed');
        storage.pipeline.fail(taskId, error);

        // Queue for manual processing
        await storage.queue.add(task);

        // Send failure notification
        await notificationManager.notifyWorkflowFailed({
          taskId,
          status: 'failed',
          error: result.error,
        });

        return {
          ...result,
          pipeline: pipelineState,
        };
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Orchestration error', err, { taskId });

      // Fail pipeline
      storage.pipeline.fail(taskId, err);
      await storage.queue.add(task);

      // Send failure notification
      await notificationManager.notifyWorkflowFailed({
        taskId,
        status: 'failed',
        error: err.message,
      });

      return {
        success: false,
        pipeline: pipelineState,
        error: err.message,
      };
    }
  }

  /**
   * Re-run only the Codex review stage
   *
   * @param taskId The task ID to rerun review for
   * @returns Rerun result
   */
  async rerunCodexReview(taskId: string): Promise<RerunResult> {
    console.log(timmy.ai(`Re-running Codex review for ${colors.bright}${taskId}${colors.reset}`));

    try {
      // Validate implementation is complete
      const branch = this.validateImplementationComplete(taskId);
      const task = this.getTaskFromPipeline(taskId);
      const repoConfig = resolveRepoConfig();

      // Update pipeline stage
      storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
        name: 'Codex Review (Re-run)',
      });

      // Execute review
      const reviewResult = await this.reviewStage.run({
        task,
        taskId,
        taskName: task.name,
        repoConfig,
      });

      if (!reviewResult.success) {
        throw new Error('Codex review returned null or failed');
      }

      // Send notification
      await notificationManager.notifyRerunComplete({
        taskId,
        stage: 'codex_review',
        status: 'completed',
        branch,
      });

      return { success: true, branch };
    } catch (error) {
      const err = error as Error;
      console.log(timmy.error(`Codex review error: ${err.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);

      // Send failure notification
      await notificationManager.notifyRerunFailed({
        taskId,
        stage: 'codex_review',
        status: 'failed',
        error: err.message,
      });

      return { success: false, error: err.message };
    }
  }

  /**
   * Re-run only the Claude fixes stage
   *
   * @param taskId The task ID to rerun fixes for
   * @returns Rerun result
   */
  async rerunClaudeFixes(taskId: string): Promise<RerunResult> {
    console.log(timmy.ai(`Re-running Claude fixes for ${colors.bright}${taskId}${colors.reset}`));

    try {
      // Validate implementation is complete
      this.validateImplementationComplete(taskId);
      const task = this.getTaskFromPipeline(taskId);
      const repoConfig = resolveRepoConfig();

      // Update pipeline stage
      storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
        name: 'Claude Fixes (Re-run)',
      });

      // Execute fixes
      const fixResult = await this.fixesStage.run({
        task,
        taskId,
        taskName: task.name,
        repoConfig,
      });

      if (!fixResult.success) {
        throw new Error('Claude fixes returned null or failed');
      }

      // Send notification
      await notificationManager.notifyRerunComplete({
        taskId,
        stage: 'claude_fixes',
        status: 'completed',
        branch: fixResult.branch,
      });

      return { success: true, branch: fixResult.branch };
    } catch (error) {
      const err = error as Error;
      console.log(timmy.error(`Claude fixes error: ${err.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, err);

      // Send failure notification
      await notificationManager.notifyRerunFailed({
        taskId,
        stage: 'claude_fixes',
        status: 'failed',
        error: err.message,
      });

      return { success: false, error: err.message };
    }
  }

  /**
   * Get task status from pipeline
   */
  getTaskStatus(taskId: string): storage.PipelineSummary | null {
    return storage.pipeline.getSummary(taskId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): storage.PipelineData[] {
    return storage.pipeline.getActive();
  }

  /**
   * Validate implementation stage is complete
   */
  private validateImplementationComplete(taskId: string): string {
    const pipelineState = storage.pipeline.get(taskId);

    if (!pipelineState) {
      throw new Error(`Task ${taskId} not found in pipeline state`);
    }

    const implementingStage = pipelineState.stages.find((s) => s.stage === 'implementing');
    if (!implementingStage || implementingStage.status !== 'completed') {
      throw new Error('Claude implementation stage not completed');
    }

    const branch = implementingStage.branch as string | undefined;
    return branch || `task-${taskId}`;
  }

  /**
   * Get minimal task object from pipeline state
   */
  private getTaskFromPipeline(taskId: string): ClickUpTask {
    const pipelineState = storage.pipeline.get(taskId);

    if (!pipelineState) {
      throw new Error(`Task ${taskId} not found in pipeline state`);
    }

    return {
      id: taskId,
      name: pipelineState.taskName,
      url: `https://app.clickup.com/t/${taskId}`,
    };
  }
}
