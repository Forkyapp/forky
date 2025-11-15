/**
 * Notification Manager - Coordinates all notification channels
 *
 * This is the main entry point for sending notifications across all channels.
 * It provides a unified interface and handles failures gracefully.
 */

import { ClickUpNotifier } from './clickup-notifier';
import { logger } from '@/shared/utils/logger.util';
import type { WorkflowNotification, StageNotification, RerunNotification } from './types';

/**
 * Notification Manager
 *
 * Coordinates notifications across multiple channels (ClickUp, Discord, etc.)
 */
export class NotificationManager {
  private clickupNotifier: ClickUpNotifier;

  constructor() {
    this.clickupNotifier = new ClickUpNotifier();
  }

  /**
   * Send workflow completion notification
   */
  async notifyWorkflowComplete(data: WorkflowNotification): Promise<void> {
    try {
      await this.clickupNotifier.notifyWorkflowComplete(data);
    } catch (error) {
      logger.error('Failed to send workflow completion notification', error as Error, {
        taskId: data.taskId,
      });
    }
  }

  /**
   * Send workflow failure notification
   */
  async notifyWorkflowFailed(data: WorkflowNotification): Promise<void> {
    try {
      await this.clickupNotifier.notifyWorkflowFailed(data);
    } catch (error) {
      logger.error('Failed to send workflow failure notification', error as Error, {
        taskId: data.taskId,
      });
    }
  }

  /**
   * Send stage start notification
   */
  async notifyStageStart(data: StageNotification): Promise<void> {
    try {
      await this.clickupNotifier.notifyStageStart(data);
    } catch (error) {
      logger.error('Failed to send stage start notification', error as Error, {
        taskId: data.taskId,
        stage: data.stage,
      });
    }
  }

  /**
   * Send stage completion notification
   */
  async notifyStageComplete(data: StageNotification): Promise<void> {
    try {
      await this.clickupNotifier.notifyStageComplete(data);
    } catch (error) {
      logger.error('Failed to send stage completion notification', error as Error, {
        taskId: data.taskId,
        stage: data.stage,
      });
    }
  }

  /**
   * Send rerun completion notification
   */
  async notifyRerunComplete(data: RerunNotification): Promise<void> {
    try {
      await this.clickupNotifier.notifyRerunComplete(data);
    } catch (error) {
      logger.error('Failed to send rerun completion notification', error as Error, {
        taskId: data.taskId,
        stage: data.stage,
      });
    }
  }

  /**
   * Send rerun failure notification
   */
  async notifyRerunFailed(data: RerunNotification): Promise<void> {
    try {
      await this.clickupNotifier.notifyRerunFailed(data);
    } catch (error) {
      logger.error('Failed to send rerun failure notification', error as Error, {
        taskId: data.taskId,
        stage: data.stage,
      });
    }
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();
