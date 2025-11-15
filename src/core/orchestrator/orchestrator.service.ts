import { timmy, colors } from '../../shared/ui';
import * as storage from '../../../lib/storage';
import { resolveRepoConfig } from '../../shared/config';
import * as clickup from '../../../lib/clickup';
import type { ClickUpTask } from '../../../lib/clickup';

// Import types
import type { ProcessTaskResult, RerunResult, StageContext } from './types';

// Import stage executors
import {
  executeAnalysisStage,
  executeImplementationStage,
  executeReviewStage,
  executeFixesStage,
} from './stages';

// Import utilities
import {
  initializePipeline,
  completePipeline,
  failPipeline,
  getTaskFromPipeline,
  validateImplementationComplete,
  getRepositoryFromPipeline,
} from './utils/pipeline-manager';

import {
  notifyWorkflowComplete,
  notifyCodexRerunComplete,
  notifyCodexRerunFailed,
  notifyFixesRerunComplete,
  notifyFixesRerunFailed,
} from './utils/notifications';

/**
 * Process a task with FULLY SYNCHRONOUS multi-AI workflow
 *
 * Flow: Gemini Analysis → Claude Implementation → Codex Review → Claude Fixes → Complete
 * All agents run in sequence, waiting for each to complete before starting the next
 */
export async function processTask(task: ClickUpTask): Promise<ProcessTaskResult> {
  const taskId = task.id;
  const taskName = task.name;

  // Detect repository from task
  const repoName = clickup.detectRepository(task);

  console.log(timmy.ai(`Starting multi-AI workflow for ${colors.bright}${taskId}${colors.reset}`));

  // Resolve repository configuration
  let repoConfig;
  try {
    repoConfig = resolveRepoConfig();
    console.log(timmy.info(`Using repository: ${repoConfig.owner}/${repoConfig.repo}`));

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

  // Initialize pipeline
  const pipelineState = initializePipeline(taskId, taskName, repoName ?? undefined);

  // Create stage context
  const context: StageContext = {
    task,
    taskId,
    taskName,
    repoConfig,
  };

  try {
    // Stage 1: Gemini Analysis
    const analysis = await executeAnalysisStage(context);

    // Stage 2: Claude Implementation
    try {
      await executeImplementationStage({ ...context, analysis });
    } catch (error) {
      const err = error as Error;
      storage.pipeline.fail(taskId, err);
      await storage.queue.add(task);
      return {
        success: false,
        pipeline: pipelineState,
        error: err.message,
      };
    }

    // Stage 3: Codex Code Review
    await executeReviewStage(context);

    // Stage 4: Qwen Unit Test Writing (DISABLED)
    // TODO: Enable when qwen.service is implemented
    // await executeQwenTestingStage(context);

    // Stage 5: Claude Fixes TODO/FIXME Comments
    await executeFixesStage(context);

    // Stage 6: Complete
    completePipeline(taskId);
    await notifyWorkflowComplete(taskId);

    return {
      success: true,
      pipeline: pipelineState,
      analysis: analysis || null,
    };
  } catch (error) {
    const err = error as Error;
    await failPipeline(taskId, task, err);

    return {
      success: false,
      pipeline: pipelineState,
      error: err.message,
    };
  }
}

/**
 * Get pipeline status for a task
 */
export function getTaskStatus(taskId: string): storage.PipelineSummary | null {
  return storage.pipeline.getSummary(taskId);
}

/**
 * Get all active tasks
 */
export function getActiveTasks(): storage.PipelineData[] {
  return storage.pipeline.getActive();
}

/**
 * Re-run only the Codex review stage
 */
export async function rerunCodexReview(taskId: string): Promise<RerunResult> {
  console.log(timmy.ai(`Re-running Codex review for ${colors.bright}${taskId}${colors.reset}`));

  try {
    // Validate implementation is complete
    const branch = validateImplementationComplete(taskId);

    // Get repository info
    const repoName = getRepositoryFromPipeline(taskId);
    if (repoName && repoName !== 'default') {
      console.log(timmy.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
    } else {
      console.log(timmy.info(`Repository: ${colors.bright}default${colors.reset}`));
    }

    const repoConfig = resolveRepoConfig();
    const task = getTaskFromPipeline(taskId);

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
      name: 'Codex Review (Re-run)',
    });

    // Execute review
    const context: StageContext = {
      task,
      taskId,
      taskName: task.name,
      repoConfig,
    };

    const reviewResult = await executeReviewStage(context);

    if (!reviewResult) {
      throw new Error('Codex review returned null');
    }

    await notifyCodexRerunComplete(taskId, branch);

    return { success: true, branch };
  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Codex review error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);
    await notifyCodexRerunFailed(taskId, err.message);

    return { success: false, error: err.message };
  }
}

/**
 * Re-run only the Claude fixes stage
 */
export async function rerunClaudeFixes(taskId: string): Promise<RerunResult> {
  console.log(timmy.ai(`Re-running Claude fixes for ${colors.bright}${taskId}${colors.reset}`));

  try {
    // Validate implementation is complete
    validateImplementationComplete(taskId);

    // Get repository info
    const repoName = getRepositoryFromPipeline(taskId);
    if (repoName && repoName !== 'default') {
      console.log(timmy.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
    } else {
      console.log(timmy.info(`Repository: ${colors.bright}default${colors.reset}`));
    }

    const repoConfig = resolveRepoConfig();
    const task = getTaskFromPipeline(taskId);

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
      name: 'Claude Fixes (Re-run)',
    });

    // Execute fixes
    const context: StageContext = {
      task,
      taskId,
      taskName: task.name,
      repoConfig,
    };

    const fixResult = await executeFixesStage(context);

    if (!fixResult) {
      throw new Error('Claude fixes returned null');
    }

    await notifyFixesRerunComplete(taskId);

    return { success: true, branch: fixResult.branch };
  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Claude fixes error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, err);
    await notifyFixesRerunFailed(taskId, err.message);

    return { success: false, error: err.message };
  }
}
