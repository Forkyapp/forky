/**
 * ClickUp API Client
 * Handles all interactions with ClickUp API
 */

import { BaseAPIClient, BaseClientConfig } from './base.client';
import { ClickUpTask, ClickUpComment, ClickUpCommentResponse } from '../../types';
import { ClickUpAPIError } from '../../shared/errors';

export interface ClickUpClientConfig extends Partial<BaseClientConfig> {
  readonly apiKey: string;
}

export class ClickUpClient extends BaseAPIClient {
  constructor(config: ClickUpClientConfig) {
    super({
      baseURL: 'https://api.clickup.com/api/v2',
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: config.timeout,
      retryOptions: config.retryOptions,
    });
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<ClickUpTask> {
    try {
      return await this.get<ClickUpTask>(`/task/${taskId}`);
    } catch (error) {
      throw new ClickUpAPIError(`Failed to fetch task ${taskId}: ${(error as Error).message}`);
    }
  }

  /**
   * Get tasks in a list
   */
  async getTasksInList(listId: string): Promise<ClickUpTask[]> {
    try {
      const response = await this.get<{ tasks: ClickUpTask[] }>(`/list/${listId}/task`);
      return response.tasks;
    } catch (error) {
      throw new ClickUpAPIError(`Failed to fetch tasks in list ${listId}: ${(error as Error).message}`);
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    try {
      await this.put(`/task/${taskId}`, { status });
    } catch (error) {
      throw new ClickUpAPIError(`Failed to update status for task ${taskId}: ${(error as Error).message}`);
    }
  }

  /**
   * Add comment to task
   */
  async addComment(taskId: string, commentText: string): Promise<ClickUpCommentResponse> {
    try {
      const data = await this.post(`/task/${taskId}/comment`, { comment_text: commentText });
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get comments for a task
   */
  async getTaskComments(taskId: string): Promise<ClickUpComment[]> {
    try {
      const response = await this.get<{ comments: ClickUpComment[] }>(`/task/${taskId}/comment`);
      return response.comments || [];
    } catch (error) {
      throw new ClickUpAPIError(`Failed to fetch comments for task ${taskId}: ${(error as Error).message}`);
    }
  }

  /**
   * Get tasks assigned to user
   */
  async getAssignedTasks(userId: number, workspaceId: string): Promise<ClickUpTask[]> {
    try {
      const response = await this.get<{ tasks: ClickUpTask[] }>(
        `/team/${workspaceId}/task`,
        {
          params: {
            assignees: [userId],
          },
        }
      );
      return response.tasks || [];
    } catch (error) {
      throw new ClickUpAPIError(`Failed to fetch assigned tasks: ${(error as Error).message}`);
    }
  }
}
