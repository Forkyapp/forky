/**
 * Legacy ClickUp API adapter
 * This file provides backward compatibility by wrapping the new src/ implementation
 *
 * Migration status: LEGACY - Use src/infrastructure/api/clickup.client.ts for new code
 */

import { ClickUpClient } from '../src/infrastructure/api/clickup.client';
import config from '../src/shared/config';
import { timmy } from '../src/shared/ui';
import type { ClickUpTask, CommentResponse, Command, Comment } from '../src/types';

// Initialize the new ClickUp client
const clickupClient = new ClickUpClient({
  apiKey: config.clickup.apiKey || '',
});

/**
 * Get assigned tasks - delegates to new implementation
 */
async function getAssignedTasks(): Promise<ClickUpTask[]> {
  try {
    if (!config.clickup.workspaceId) {
      console.log(timmy.error('No workspace ID configured'));
      return [];
    }

    if (!config.clickup.botUserId) {
      console.log(timmy.error('No bot user ID configured'));
      return [];
    }

    const tasks = await clickupClient.getAssignedTasks(
      config.clickup.botUserId,
      config.clickup.workspaceId,
      {
        statuses: ['bot in progress'],
        subtasks: true,
        includeClosed: false,
      }
    );

    return tasks;
  } catch (error) {
    console.log(timmy.error(`Failed to fetch tasks: ${(error as Error).message}`));
    return [];
  }
}

/**
 * Update task status - delegates to new implementation
 */
async function updateStatus(taskId: string, statusId: string): Promise<void> {
  try {
    await clickupClient.updateTaskStatus(taskId, statusId);
  } catch (error) {
    console.log(timmy.error(`Status update failed: ${(error as Error).message}`));
  }
}

/**
 * Update task description - delegates to new implementation
 */
async function updateTaskDescription(taskId: string, description: string): Promise<void> {
  try {
    await clickupClient.updateTaskDescription(taskId, description);
    console.log(timmy.success(`Task description updated for ${taskId}`));
  } catch (error) {
    console.log(timmy.error(`Description update failed: ${(error as Error).message}`));
    throw error;
  }
}

/**
 * Add comment to task - delegates to new implementation with comment disable check
 */
async function addComment(taskId: string, commentText: string): Promise<CommentResponse> {
  // Check if comments are disabled
  if (process.env.DISABLE_COMMENTS === 'true') {
    console.log(timmy.info(`Comment skipped (disabled) for task ${taskId}`));
    return { success: true, disabled: true };
  }

  try {
    const result = await clickupClient.addComment(taskId, commentText);
    if (result.success) {
      console.log(timmy.success(`Comment posted to task ${taskId}`));
    }
    return result;
  } catch (error) {
    console.log(timmy.error(`Comment failed for task ${taskId}: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get comments for a task - delegates to new implementation
 */
async function getTaskComments(taskId: string): Promise<Comment[]> {
  try {
    return await clickupClient.getTaskComments(taskId);
  } catch (error) {
    console.log(timmy.error(`Failed to fetch comments for task ${taskId}: ${(error as Error).message}`));
    return [];
  }
}

/**
 * Parse command from comment text
 * Supported commands:
 * - "re-run check" or "rerun check" - Re-run Codex review
 * - "re-run fixes" or "rerun fixes" - Re-run Claude fixes
 * @param commentText - Comment text
 * @returns Command object or null
 */
function parseCommand(commentText: string | undefined | null): Command | null {
  if (!commentText) return null;

  const text = commentText.toLowerCase().trim();

  // Re-run Codex review
  if (text.includes('re-run check') || text.includes('rerun check')) {
    return { type: 'rerun-codex-review' };
  }

  // Re-run Claude fixes
  if (text.includes('re-run fixes') || text.includes('rerun fixes')) {
    return { type: 'rerun-claude-fixes' };
  }

  return null;
}

/**
 * Detect repository name from task
 * Checks in order: custom fields, tags, description
 * @param task - ClickUp task object
 * @returns Repository name or null for default
 */
function detectRepository(task: ClickUpTask): string | null {
  // 1. Check custom fields for 'Repository' or 'repository'
  if (task.custom_fields && Array.isArray(task.custom_fields)) {
    const repoField = task.custom_fields.find(
      field => field.name?.toLowerCase() === 'repository'
    );
    if (repoField?.value) {
      return repoField.value;
    }
  }

  // 2. Check tags for 'repo:name' pattern
  if (task.tags && Array.isArray(task.tags)) {
    const repoTag = task.tags.find(tag => tag.name?.startsWith('repo:'));
    if (repoTag) {
      return repoTag.name.replace('repo:', '').trim();
    }
  }

  // 3. Parse description for [Repo: name] or [Repository: name]
  const description = task.description || task.text_content || '';
  const repoMatch = description.match(/\[Repo(?:sitory)?:\s*([^\]]+)\]/i);
  if (repoMatch && repoMatch[1]) {
    return repoMatch[1].trim();
  }

  // No repository specified, use default
  return null;
}

export {
  getAssignedTasks,
  updateStatus,
  updateTaskDescription,
  addComment,
  getTaskComments,
  parseCommand,
  detectRepository,
  ClickUpTask,
  Comment,
  CommentResponse,
  Command
};
