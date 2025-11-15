import { timmy, colors } from '../../../shared/ui';
import * as storage from '../../../../lib/storage';
import * as claude from '../../ai-services/claude.service';
import type { ImplementationResult, AnalysisContext } from '../types';

/**
 * Execute Claude implementation stage
 */
export async function executeImplementationStage(
  context: AnalysisContext
): Promise<ImplementationResult> {
  const { task, taskId, analysis, repoConfig } = context;

  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, {
    name: 'Claude Implementation',
  });

  try {
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

    if (!result.success) {
      throw new Error(result.error || 'Claude implementation failed');
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, {
      branch: result.branch,
    });

    console.log(
      timmy.success(
        `${colors.bright}Claude${colors.reset} implementation complete for ${colors.bright}${taskId}${colors.reset}`
      )
    );

    return result;
  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Claude implementation error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, err);
    throw err;
  }
}
