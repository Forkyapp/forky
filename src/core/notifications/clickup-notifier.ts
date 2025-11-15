/**
 * ClickUp Notifier - Sends notifications to ClickUp task comments
 *
 * This module handles all ClickUp-specific notification formatting and posting.
 */

import * as clickup from '../../../lib/clickup';
import { logger } from '@/shared/utils/logger.util';
import type { WorkflowNotification, StageNotification, RerunNotification } from './types';

/**
 * ClickUp Notification Service
 *
 * Handles posting formatted notifications as ClickUp comments
 */
export class ClickUpNotifier {
  /**
   * Send workflow completion notification
   */
  async notifyWorkflowComplete(data: WorkflowNotification): Promise<void> {
    const { taskId, branch } = data;

    try {
      await clickup.addComment(
        taskId,
        `🎉 **Workflow Complete**\n\n` +
          `Full multi-AI workflow has finished:\n` +
          `✅ Gemini Analysis\n` +
          `✅ Claude Implementation\n` +
          `✅ Codex Review\n` +
          `✅ Claude Fixes\n\n` +
          `**Branch:** \`${branch || `task-${taskId}`}\`\n` +
          `**Status:** Ready for review`
      );

      logger.info('Workflow completion notification sent', { taskId, branch });
    } catch (error) {
      logger.error('Failed to send workflow completion notification', error as Error, {
        taskId,
        branch,
      });
    }
  }

  /**
   * Send workflow failure notification
   */
  async notifyWorkflowFailed(data: WorkflowNotification): Promise<void> {
    const { taskId, stage, error } = data;

    try {
      await clickup.addComment(
        taskId,
        `❌ **Workflow Failed**\n\n` +
          `The workflow encountered an error${stage ? ` during ${stage}` : ''}.\n\n` +
          `**Error:** ${error || 'Unknown error'}\n` +
          `**Status:** Failed`
      );

      logger.info('Workflow failure notification sent', { taskId, stage, error });
    } catch (notifError) {
      logger.error('Failed to send workflow failure notification', notifError as Error, {
        taskId,
        stage,
        error,
      });
    }
  }

  /**
   * Send stage start notification
   */
  async notifyStageStart(data: StageNotification): Promise<void> {
    const { taskId, stage } = data;

    try {
      const emoji = this.getStageEmoji(stage);
      const stageName = this.getStageName(stage);

      await clickup.addComment(
        taskId,
        `${emoji} **${stageName} Started**\n\n` +
          `${stageName} is now in progress.\n\n` +
          `**Status:** Running`
      );

      logger.info('Stage start notification sent', { taskId, stage });
    } catch (error) {
      logger.error('Failed to send stage start notification', error as Error, { taskId, stage });
    }
  }

  /**
   * Send stage completion notification
   */
  async notifyStageComplete(data: StageNotification): Promise<void> {
    const { taskId, stage, details } = data;

    try {
      const stageName = this.getStageName(stage);

      await clickup.addComment(
        taskId,
        `✅ **${stageName} Complete**\n\n` +
          `${stageName} has finished successfully.\n\n` +
          this.formatDetails(details) +
          `**Status:** Complete`
      );

      logger.info('Stage completion notification sent', { taskId, stage, details });
    } catch (error) {
      logger.error('Failed to send stage completion notification', error as Error, {
        taskId,
        stage,
      });
    }
  }

  /**
   * Send rerun completion notification
   */
  async notifyRerunComplete(data: RerunNotification): Promise<void> {
    const { taskId, stage, branch } = data;

    try {
      const stageName = stage === 'codex_review' ? 'Codex Review' : 'Claude Fixes';

      await clickup.addComment(
        taskId,
        `✅ **${stageName} Re-run Complete**\n\n` +
          `${stageName} has finished successfully.\n\n` +
          `**Branch:** \`${branch || `task-${taskId}`}\`\n` +
          `**Status:** Complete`
      );

      logger.info('Rerun completion notification sent', { taskId, stage, branch });
    } catch (error) {
      logger.error('Failed to send rerun completion notification', error as Error, {
        taskId,
        stage,
      });
    }
  }

  /**
   * Send rerun failure notification
   */
  async notifyRerunFailed(data: RerunNotification): Promise<void> {
    const { taskId, stage, error } = data;

    try {
      const stageName = stage === 'codex_review' ? 'Codex Review' : 'Claude Fixes';

      await clickup.addComment(
        taskId,
        `❌ **${stageName} Re-run Failed**\n\n` + `**Error:** ${error || 'Unknown error'}`
      );

      logger.info('Rerun failure notification sent', { taskId, stage, error });
    } catch (notifError) {
      logger.error('Failed to send rerun failure notification', notifError as Error, {
        taskId,
        stage,
        error,
      });
    }
  }

  /**
   * Get emoji for stage
   */
  private getStageEmoji(stage: string): string {
    const emojiMap: Record<string, string> = {
      analyzing: '🧠',
      implementing: '💻',
      codex_reviewing: '🔍',
      claude_fixing: '🔧',
    };

    return emojiMap[stage] || '📝';
  }

  /**
   * Get friendly stage name
   */
  private getStageName(stage: string): string {
    const nameMap: Record<string, string> = {
      analyzing: 'Gemini Analysis',
      implementing: 'Claude Implementation',
      codex_reviewing: 'Codex Review',
      claude_fixing: 'Claude Fixes',
    };

    return nameMap[stage] || stage;
  }

  /**
   * Format details for notification
   */
  private formatDetails(details?: Record<string, unknown>): string {
    if (!details || Object.keys(details).length === 0) {
      return '';
    }

    const lines = Object.entries(details)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `**${this.formatKey(key)}:** ${value}`)
      .join('\n');

    return lines ? `${lines}\n\n` : '';
  }

  /**
   * Format key to human-readable
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
