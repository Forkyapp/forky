import path from 'path';
import { timmy, colors } from '../../../shared/ui';
import * as storage from '../../../../lib/storage';
import * as gemini from '../../ai-services/gemini.service';
import * as clickup from '../../../../lib/clickup';
import type { AnalysisResult, StageContext } from '../types';

/**
 * Execute Gemini analysis stage
 */
export async function executeAnalysisStage(
  context: StageContext
): Promise<AnalysisResult | null> {
  const { task, taskId } = context;

  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.ANALYZING, {
    name: 'Gemini Analysis',
  });

  let analysis: AnalysisResult | null = null;
  let usedFallback = false;

  try {
    // Post Gemini start comment
    await clickup.addComment(
      taskId,
      `🧠 **Gemini Analysis Started**\n\n` +
        `Gemini AI is analyzing the task to create a detailed feature specification.\n\n` +
        `**Status:** Analyzing requirements and architecture`
    );

    analysis = await gemini.analyzeTask(task, { repoConfig: context.repoConfig });

    if (analysis.fallback) {
      usedFallback = true;
      console.log(timmy.warning('Using fallback analysis'));
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.ANALYZING, {
      featureSpecFile: analysis.featureSpecFile,
      fallback: usedFallback,
      logFile: analysis.logFile,
    });

    storage.pipeline.updateMetadata(taskId, {
      geminiAnalysis: {
        file: analysis.featureSpecFile,
        fallback: usedFallback,
        logFile: analysis.logFile,
      },
    });

    // Store Gemini execution info
    storage.pipeline.storeAgentExecution(taskId, 'gemini', {
      logFile: analysis.logFile,
      progressFile: analysis.progressFile,
      featureSpecFile: analysis.featureSpecFile,
    });

    // Post Gemini completion comment
    await clickup.addComment(
      taskId,
      `✅ **Gemini Analysis Complete**\n\n` +
        `Feature specification has been created.\n\n` +
        `**Spec File:** \`${path.basename(analysis.featureSpecFile)}\`\n` +
        `**Status:** ${usedFallback ? 'Fallback mode (Gemini unavailable)' : 'Success'}\n\n` +
        `Next: Claude will implement the feature`
    );

    return analysis;
  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Gemini analysis failed: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.ANALYZING, err);

    // Continue without analysis
    console.log(
      timmy.info(`Continuing without ${colors.bright}Gemini${colors.reset} analysis`)
    );

    return null;
  }
}
