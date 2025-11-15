import { timmy, colors } from '../../../shared/ui';
import * as storage from '../../../../lib/storage';
import * as claude from '../../ai-services/claude.service';
import type { FixResult, StageContext } from '../types';

/**
 * Execute Claude fixes stage (TODO/FIXME comments)
 */
export async function executeFixesStage(context: StageContext): Promise<FixResult | null> {
  const { task, taskId, repoConfig } = context;

  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
    name: 'Claude Fixes',
  });

  try {
    const fixResult = await claude.fixTodoComments(task, { repoConfig });

    if (!fixResult.success) {
      throw new Error(fixResult.error || 'Claude fixes failed');
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
      branch: fixResult.branch,
    });

    console.log(
      timmy.success(
        `${colors.bright}Claude${colors.reset} fixes complete for ${colors.bright}${taskId}${colors.reset}`
      )
    );

    return fixResult;
  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Claude fixes error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, err);
    // Continue even if fixes fail - not critical
    console.log(timmy.warning(`Continuing without Claude fixes`));
    return null;
  }
}
