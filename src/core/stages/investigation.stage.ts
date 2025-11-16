/**
 * Investigation Stage - Claude-powered codebase investigation
 *
 * This stage uses Claude to search the codebase for issue locations
 * and updates the ClickUp task description with technical findings
 */

import * as storage from '../../../lib/storage';
import * as investigator from '../ai-services/claude-investigator.service';
import * as clickup from '../../../lib/clickup';
import { BaseStage } from './base-stage';
import type { StageContext, InvestigationResult } from './types';

/**
 * Claude Investigation Stage
 *
 * Searches codebase and updates task description with technical details
 */
export class InvestigationStage extends BaseStage<InvestigationResult> {
  protected readonly stageName = 'Investigation';

  /**
   * Execute Claude investigation
   *
   * @param context The stage execution context
   * @returns Investigation result with enhanced task description
   */
  async execute(context: StageContext): Promise<InvestigationResult> {
    const { task, taskId, repoConfig } = context;

    // Update pipeline stage
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.INVESTIGATING, {
      name: 'Claude Investigation',
    });

    try {
      // Post start notification
      await this.notifyInvestigationStart(taskId);

      this.logAI('Searching codebase for issue locations...', 'Claude Investigator');

      // Execute Claude investigation
      const investigation = await investigator.investigateIssue(task, { repoConfig });

      if (!investigation.success) {
        this.logWarning('Investigation completed with errors (using fallback)');
      }

      // Update ClickUp task description with investigation findings
      await this.updateProgress('Updating task description with technical details...');
      await clickup.updateTaskDescription(taskId, investigation.detailedDescription);
      this.logSuccess('Task description updated');

      // Update pipeline with results
      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.INVESTIGATING, {
        investigationFile: investigation.investigationFile,
        filesIdentified: investigation.filesIdentified.length,
      });

      storage.pipeline.updateMetadata(taskId, {
        investigation: {
          file: investigation.investigationFile,
          filesCount: investigation.filesIdentified.length,
          files: investigation.filesIdentified,
        },
      });

      // Post completion notification
      await this.notifyInvestigationComplete(taskId, investigation);

      this.logSuccess('Investigation complete', {
        filesFound: investigation.filesIdentified.length,
        success: investigation.success,
      });

      return {
        ...investigation,
        success: true,
      };
    } catch (error) {
      const err = error as Error;
      this.logError(`Investigation failed: ${err.message}`, err);

      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.INVESTIGATING, err);

      // Post error notification
      await this.notifyInvestigationError(taskId, err);

      // Return partial success (workflow can continue without investigation)
      this.logWarning('Continuing with original task description');

      return {
        success: false,
        error: err.message,
        detailedDescription: task.description || task.text_content || '',
        filesIdentified: [],
        technicalContext: '',
      };
    }
  }

  /**
   * Post ClickUp comment when investigation starts
   */
  private async notifyInvestigationStart(taskId: string): Promise<void> {
    try {
      await clickup.addComment(
        taskId,
        `🔍 **Investigation Started**\n\n` +
          `Claude is searching the codebase to identify where this issue is located.\n\n` +
          `**Status:** Analyzing repository structure and searching for relevant files`
      );
    } catch (error) {
      this.logWarning('Failed to post start notification', { error: (error as Error).message });
    }
  }

  /**
   * Post ClickUp comment when investigation completes
   */
  private async notifyInvestigationComplete(
    taskId: string,
    investigation: InvestigationResult
  ): Promise<void> {
    try {
      const filesListMarkdown = investigation.filesIdentified
        .slice(0, 5)
        .map((f) => `- \`${f}\``)
        .join('\n');
      const moreFilesText =
        investigation.filesIdentified.length > 5
          ? `\n...and ${investigation.filesIdentified.length - 5} more files`
          : '';

      await clickup.addComment(
        taskId,
        `✅ **Investigation Complete**\n\n` +
          `Claude has analyzed the codebase and identified relevant files.\n\n` +
          `**Files Identified:** ${investigation.filesIdentified.length}\n` +
          (investigation.filesIdentified.length > 0
            ? `**Key Files:**\n${filesListMarkdown}${moreFilesText}\n\n`
            : '') +
          `**Task Description:** Updated with technical details\n` +
          `**Status:** ${investigation.success ? 'Success' : 'Completed with fallback'}\n\n` +
          `Next: Gemini will create feature specification`
      );
    } catch (error) {
      this.logWarning('Failed to post completion notification', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Post ClickUp comment when investigation fails
   */
  private async notifyInvestigationError(taskId: string, error: Error): Promise<void> {
    try {
      await clickup.addComment(
        taskId,
        `⚠️ **Investigation Warning**\n\n` +
          `Investigation encountered an error: ${error.message}\n\n` +
          `Continuing with original task description.`
      );
    } catch (err) {
      this.logWarning('Failed to post error notification', { error: (err as Error).message });
    }
  }
}
