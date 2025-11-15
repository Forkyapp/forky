/**
 * Analysis Stage - Gemini-powered task analysis
 *
 * This stage uses Gemini AI to analyze the task and generate a detailed
 * feature specification that guides the implementation.
 */

import path from 'path';
import * as storage from '../../../lib/storage';
import * as gemini from '../ai-services/gemini.service';
import * as clickup from '../../../lib/clickup';
import { BaseStage } from './base-stage';
import type { StageContext, AnalysisResult } from './types';

/**
 * Gemini Analysis Stage
 *
 * Analyzes ClickUp task and generates feature specification
 */
export class AnalysisStage extends BaseStage<AnalysisResult> {
  protected readonly stageName = 'Analysis';

  /**
   * Execute Gemini analysis
   *
   * @param context The stage execution context
   * @returns Analysis result with feature specification
   */
  async execute(context: StageContext): Promise<AnalysisResult> {
    const { task, taskId, repoConfig } = context;

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.ANALYZING, {
      name: 'Gemini Analysis',
    });

    let usedFallback = false;

    try {
      // Post start notification
      await this.notifyAnalysisStart(taskId);

      this.logAI('Analyzing task requirements...', 'Gemini');

      // Execute Gemini analysis
      const analysis = await gemini.analyzeTask(task, { repoConfig });

      if (analysis.fallback) {
        usedFallback = true;
        this.logWarning('Using fallback analysis (Gemini unavailable)');
      }

      // Update pipeline with results
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

      // Store agent execution info
      storage.pipeline.storeAgentExecution(taskId, 'gemini', {
        logFile: analysis.logFile,
        progressFile: analysis.progressFile,
        featureSpecFile: analysis.featureSpecFile,
      });

      // Post completion notification
      await this.notifyAnalysisComplete(taskId, analysis, usedFallback);

      this.logSuccess('Feature specification created', {
        specFile: path.basename(analysis.featureSpecFile),
        fallback: usedFallback,
      });

      return {
        ...analysis,
        success: true,
      };
    } catch (error) {
      const err = error as Error;
      this.logError(`Analysis failed: ${err.message}`, err);

      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.ANALYZING, err);

      // Return partial success (workflow can continue without analysis)
      this.logWarning('Continuing without Gemini analysis');

      return {
        success: false,
        error: err.message,
        featureSpecFile: '',
        fallback: true,
      };
    }
  }

  /**
   * Post ClickUp comment when analysis starts
   */
  private async notifyAnalysisStart(taskId: string): Promise<void> {
    try {
      await clickup.addComment(
        taskId,
        `🧠 **Gemini Analysis Started**\n\n` +
          `Gemini AI is analyzing the task to create a detailed feature specification.\n\n` +
          `**Status:** Analyzing requirements and architecture`
      );
    } catch (error) {
      this.logWarning('Failed to post start notification', { error: (error as Error).message });
    }
  }

  /**
   * Post ClickUp comment when analysis completes
   */
  private async notifyAnalysisComplete(
    taskId: string,
    analysis: AnalysisResult,
    usedFallback: boolean
  ): Promise<void> {
    try {
      await clickup.addComment(
        taskId,
        `✅ **Gemini Analysis Complete**\n\n` +
          `Feature specification has been created.\n\n` +
          `**Spec File:** \`${path.basename(analysis.featureSpecFile)}\`\n` +
          `**Status:** ${usedFallback ? 'Fallback mode (Gemini unavailable)' : 'Success'}\n\n` +
          `Next: Claude will implement the feature`
      );
    } catch (error) {
      this.logWarning('Failed to post completion notification', {
        error: (error as Error).message,
      });
    }
  }
}
