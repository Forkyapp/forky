/**
 * Workflow Executor - Executes workflow stages in sequence
 *
 * This class handles the sequential execution of pipeline stages,
 * managing stage transitions and error handling.
 */

import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';
import { resolveRepoConfig } from '@/shared/config';
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

    try {
      // Resolve repository configuration
      repoConfig = resolveRepoConfig();
      console.log(timmy.info(`Using repository: ${repoConfig.owner}/${repoConfig.repo}`));
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to resolve repository configuration', err, { taskId });
      return {
        success: false,
        error: `Repository configuration error: ${err.message}`,
      };
    }

    // Create base stage context
    const baseContext: StageContext = {
      task,
      taskId,
      taskName,
      repoConfig,
    };

    try {
      // Stage 1: Gemini Analysis
      if (!this.shouldSkipStage('analysis', options)) {
        console.log(timmy.info('Stage 1: Gemini Analysis'));
        analysis = await this.analysisStage.run(baseContext);

        // Analysis failure is not critical - continue without it
        if (!analysis.success) {
          logger.warn('Analysis stage failed, continuing without analysis', { taskId });
        }
      }

      // Stage 2: Claude Implementation
      if (!this.shouldSkipStage('implementation', options)) {
        console.log(timmy.info('Stage 2: Claude Implementation'));

        const implContext: ImplementationStageContext = {
          ...baseContext,
          analysis,
        };

        const implResult = await this.implementationStage.run(implContext);

        // Implementation failure is critical - stop workflow
        if (!implResult.success) {
          throw new Error(implResult.error || 'Implementation failed');
        }
      }

      // Stage 3: Codex Review
      if (!this.shouldSkipStage('review', options)) {
        console.log(timmy.info('Stage 3: Codex Code Review'));
        const reviewResult = await this.reviewStage.run(baseContext);

        // Review failure is not critical - log and continue
        if (!reviewResult.success) {
          logger.warn('Review stage failed, continuing workflow', { taskId });
        }
      }

      // Stage 4: Claude Fixes
      if (!this.shouldSkipStage('fixes', options)) {
        console.log(timmy.info('Stage 4: Claude Fixes'));
        const fixResult = await this.fixesStage.run(baseContext);

        // Fixes failure is not critical - log and continue
        if (!fixResult.success) {
          logger.warn('Fixes stage failed, continuing workflow', { taskId });
        }
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
    }
  }

  /**
   * Check if a stage should be skipped
   */
  private shouldSkipStage(stageName: string, options: WorkflowOptions): boolean {
    return options.skipStages?.includes(stageName) || false;
  }
}
