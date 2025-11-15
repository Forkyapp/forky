/**
 * Implementation Stage - Claude-powered code implementation
 *
 * This stage uses Claude Code to implement the feature based on the
 * analysis specification (if available) or directly from the task description.
 */

import * as storage from '../../../lib/storage';
import * as claude from '../ai-services/claude.service';
import { BaseStage } from './base-stage';
import type { ImplementationStageContext, ImplementationResult } from './types';

/**
 * Claude Implementation Stage
 *
 * Implements the feature using Claude Code CLI
 */
export class ImplementationStage extends BaseStage<ImplementationResult> {
  protected readonly stageName = 'Implementation';

  /**
   * Execute Claude implementation
   *
   * @param context The stage execution context (includes analysis result)
   * @returns Implementation result with branch information
   */
  async execute(context: ImplementationStageContext): Promise<ImplementationResult> {
    const { task, taskId, analysis, repoConfig } = context;

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, {
      name: 'Claude Implementation',
    });

    try {
      this.logAI('Starting feature implementation...', 'Claude');

      if (analysis?.featureSpecFile) {
        await this.updateProgress(`Using analysis from: ${analysis.featureSpecFile}`);
      } else {
        this.logWarning('No analysis available, implementing from task description');
      }

      // Execute Claude implementation
      const result = await claude.launchClaude(task, {
        analysis:
          analysis && analysis.content
            ? {
                content: analysis.content,
                featureDir: analysis.featureDir,
                featureSpecFile: analysis.featureSpecFile,
              }
            : undefined,
        repoConfig,
      });

      // Check if implementation succeeded
      if (!result.success) {
        throw new Error(result.error || 'Claude implementation failed');
      }

      // Update pipeline with success
      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, {
        branch: result.branch,
      });

      this.logSuccess(`Implementation complete on branch: ${result.branch}`, {
        branch: result.branch,
        logFile: result.logFile,
      });

      return result;
    } catch (error) {
      const err = error as Error;
      this.logError(`Implementation failed: ${err.message}`, err);

      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, err);

      // Implementation failure is critical - don't continue
      throw err;
    }
  }

  /**
   * Validate that we have necessary information for implementation
   */
  protected async validateDependencies(context: ImplementationStageContext): Promise<void> {
    await super.validateDependencies(context);

    if (!context.repoConfig.path) {
      throw new Error('Repository path is required for implementation');
    }

    if (!context.task.name && !context.task.description) {
      throw new Error('Task must have either a name or description for implementation');
    }
  }
}
