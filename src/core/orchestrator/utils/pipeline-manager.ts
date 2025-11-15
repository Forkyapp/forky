import { timmy, colors } from '../../../shared/ui';
import * as storage from '../../../../lib/storage';
import type { ClickUpTask } from '../../../../lib/clickup';

/**
 * Initialize pipeline for a task
 */
export function initializePipeline(
  taskId: string,
  taskName: string,
  repoName?: string
): storage.PipelineData {
  const pipelineState = storage.pipeline.init(taskId, { name: taskName });

  // Set repository in metadata
  storage.pipeline.updateMetadata(taskId, {
    repository: repoName || 'default',
  });

  return pipelineState;
}

/**
 * Complete pipeline with success
 */
export function completePipeline(taskId: string): void {
  storage.pipeline.complete(taskId, {
    branch: `task-${taskId}`,
    completedAt: new Date().toISOString(),
  });

  console.log(
    timmy.success(`🎉 Multi-AI workflow complete for ${colors.bright}${taskId}${colors.reset}`)
  );
}

/**
 * Fail pipeline and queue task for manual processing
 */
export async function failPipeline(
  taskId: string,
  task: ClickUpTask,
  error: Error
): Promise<void> {
  console.log(timmy.error(`Orchestration error: ${error.message}`));
  storage.pipeline.fail(taskId, error);

  // Queue for manual processing
  await storage.queue.add(task);
}

/**
 * Get minimal task object from pipeline state
 */
export function getTaskFromPipeline(taskId: string): ClickUpTask {
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

/**
 * Validate implementation stage is complete
 */
export function validateImplementationComplete(taskId: string): string {
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
 * Get repository from pipeline metadata
 */
export function getRepositoryFromPipeline(taskId: string): string | undefined {
  const pipelineState = storage.pipeline.get(taskId);
  return pipelineState?.metadata?.repository;
}
