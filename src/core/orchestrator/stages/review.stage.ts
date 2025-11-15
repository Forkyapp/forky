import { timmy, colors } from '../../../shared/ui';
import * as storage from '../../../../lib/storage';
import * as codex from '../../monitoring/codex.service';
import type { ReviewResult, StageContext } from '../types';

/**
 * Execute Codex code review stage
 */
export async function executeReviewStage(context: StageContext): Promise<ReviewResult | null> {
  const { task, taskId, repoConfig } = context;

  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
    name: 'Codex Review',
  });

  try {
    const reviewResult = await codex.reviewClaudeChanges(task, { repoConfig });

    if (!reviewResult.success) {
      throw new Error(reviewResult.error || 'Codex review failed');
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
      branch: reviewResult.branch,
    });

    console.log(
      timmy.success(
        `${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`
      )
    );

    return reviewResult;
  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Codex review error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);
    // Continue even if review fails - not critical
    console.log(timmy.warning(`Continuing without Codex review`));
    return null;
  }
}
