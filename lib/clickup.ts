import axios, { AxiosError } from 'axios';
import config from './config';
import { forky, colors } from './ui';

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  text_content?: string;
  status?: {
    status: string;
  };
  custom_fields?: Array<{
    name?: string;
    value?: string;
  }>;
  tags?: Array<{
    name: string;
  }>;
}

interface CommentResponse {
  success: boolean;
  disabled?: boolean;
  data?: any;
  error?: string;
}

interface Command {
  type: string;
}

interface Comment {
  id: string;
  comment_text: string;
  user: {
    id: number;
    username: string;
  };
  date: string;
}

async function getAssignedTasks(): Promise<ClickUpTask[]> {
  try {
    // MANUAL MODE: Fetch specific task by ID
    const TASK_ID = '869ajuxp3';
    console.log(forky.info(`[MANUAL MODE] Fetching specific task: ${colors.bright}${TASK_ID}${colors.reset}`));

    const response = await axios.get<ClickUpTask>(
      `https://api.clickup.com/api/v2/task/${TASK_ID}`,
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const task = response.data;
    console.log(forky.success(`Task found: "${task.name}"`));
    console.log(forky.info(`Status: ${colors.bright}${task.status?.status || 'unknown'}${colors.reset}`));

    // Return as array with single task
    return [task];
  } catch (error) {
    const axiosError = error as AxiosError;
    console.log(forky.error(`Failed to fetch task: ${axiosError.message}`));
    if (axiosError.response) {
      console.log(forky.error(`Status code: ${axiosError.response.status}`));
      console.log(forky.error(`Response data: ${JSON.stringify(axiosError.response.data, null, 2)}`));
    }
    return [];
  }
}

async function updateStatus(taskId: string, statusId: string): Promise<void> {
  try {
    await axios.put(
      `https://api.clickup.com/api/v2/task/${taskId}`,
      { status: statusId },
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.log(forky.error(`Status update failed: ${(error as Error).message}`));
  }
}

async function addComment(taskId: string, commentText: string): Promise<CommentResponse> {
  // Check if comments are disabled
  if (process.env.DISABLE_COMMENTS === 'true') {
    console.log(forky.info(`Comment skipped (disabled) for task ${taskId}`));
    return { success: true, disabled: true };
  }

  try {
    const response = await axios.post(
      `https://api.clickup.com/api/v2/task/${taskId}/comment`,
      { comment_text: commentText },
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(forky.success(`Comment posted to task ${taskId}`));
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError;
    console.log(forky.error(`Comment failed for task ${taskId}: ${axiosError.message}`));
    if (axiosError.response) {
      console.log(forky.error(`Status: ${axiosError.response.status}`));
      console.log(forky.error(`Details: ${JSON.stringify(axiosError.response.data)}`));
    }
    return { success: false, error: axiosError.message };
  }
}

/**
 * Get comments for a task
 * @param taskId - ClickUp task ID
 * @returns Array of comments
 */
async function getTaskComments(taskId: string): Promise<Comment[]> {
  try {
    const response = await axios.get<{ comments: Comment[] }>(
      `https://api.clickup.com/api/v2/task/${taskId}/comment`,
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.comments || [];
  } catch (error) {
    console.log(forky.error(`Failed to fetch comments for task ${taskId}: ${(error as Error).message}`));
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
  addComment,
  getTaskComments,
  parseCommand,
  detectRepository,
  ClickUpTask,
  Comment,
  CommentResponse,
  Command
};
