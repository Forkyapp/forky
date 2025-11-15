/**
 * Review Stage - Codex-powered code review
 *
 * This stage uses Codex AI to review the implemented code for quality,
 * best practices, and potential issues.
 */

import * as storage from '../../../lib/storage';
import * as codex from '../monitoring/codex.service';
import { BaseStage } from './base-stage';
import type { StageContext, ReviewResult } from './types';

/**
 * Codex Code Review Stage
 *
 * Reviews code quality and suggests improvements
 */
export class ReviewStage extends BaseStage<ReviewResult> {
  protected readonly stageName = 'Review';

  /**
   * Execute Codex code review
   *
   * @param context The stage execution context
   * @returns Review result with feedback
   */
  async execute(context: StageContext): Promise<ReviewResult> {
    const { task, taskId, repoConfig } = context;

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
      name: 'Codex Review',
    });

    try {
      this.logAI('Reviewing code quality...', 'Codex');

      // Execute Codex review
      const reviewResult = await codex.reviewClaudeChanges(task, { repoConfig });

      // Check if review succeeded
      if (!reviewResult.success) {
        throw new Error(reviewResult.error || 'Codex review failed');
      }

      // Update pipeline with success
      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
        branch: reviewResult.branch,
      });

      this.logSuccess('Code review complete', {
        branch: reviewResult.branch,
      });

      return reviewResult;
    } catch (error) {
      const err = error as Error;
      this.logError(`Code review failed: ${err.message}`, err);

      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);

      // Review failure is not critical - continue workflow
      this.logWarning('Continuing without Codex review');

      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Validate that implementation stage completed
   */
  protected async validateDependencies(context: StageContext): Promise<void> {
    await super.validateDependencies(context);

    // Check if implementation stage completed
    const pipelineState = storage.pipeline.get(context.taskId);
    if (!pipelineState) {
      throw new Error('Pipeline state not found');
    }

    const implementingStage = pipelineState.stages.find((s) => s.stage === 'implementing');
    if (!implementingStage || implementingStage.status !== 'completed') {
      throw new Error('Implementation stage must be completed before review');
    }
  }
}
