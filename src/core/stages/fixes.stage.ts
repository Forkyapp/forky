/**
 * Fixes Stage - Claude-powered TODO/FIXME resolution
 *
 * This stage uses Claude Code to fix TODO and FIXME comments left
 * during implementation or identified during review.
 */

import * as storage from '../../../lib/storage';
import * as claude from '../ai-services/claude.service';
import { BaseStage } from './base-stage';
import type { StageContext, FixResult } from './types';

/**
 * Claude Fixes Stage
 *
 * Fixes TODO and FIXME comments in the code
 */
export class FixesStage extends BaseStage<FixResult> {
  protected readonly stageName = 'Fixes';

  /**
   * Execute Claude fixes
   *
   * @param context The stage execution context
   * @returns Fix result with information about resolved issues
   */
  async execute(context: StageContext): Promise<FixResult> {
    const { task, taskId, repoConfig } = context;

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
      name: 'Claude Fixes',
    });

    try {
      this.logAI('Fixing TODO/FIXME comments...', 'Claude');

      // Execute Claude fixes
      const fixResult = await claude.fixTodoComments(task, { repoConfig });

      // Check if fixes succeeded
      if (!fixResult.success) {
        throw new Error(fixResult.error || 'Claude fixes failed');
      }

      // Update pipeline with success
      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
        branch: fixResult.branch,
      });

      this.logSuccess('TODO/FIXME fixes complete', {
        branch: fixResult.branch,
      });

      return fixResult;
    } catch (error) {
      const err = error as Error;
      this.logError(`Fixes failed: ${err.message}`, err);

      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, err);

      // Fixes failure is not critical - continue workflow
      this.logWarning('Continuing without Claude fixes');

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
      throw new Error('Implementation stage must be completed before fixes');
    }
  }
}
