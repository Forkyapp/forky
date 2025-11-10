const axios = require('axios');
const config = require('./config');
const { jarvis, colors } = require('./ui');

async function getAssignedTasks() {
  try {
    // MANUAL MODE: Fetch specific task by ID
    const TASK_ID = '869ajuxp3';
    console.log(jarvis.info(`[MANUAL MODE] Fetching specific task: ${colors.bright}${TASK_ID}${colors.reset}`));

    const response = await axios.get(
      `https://api.clickup.com/api/v2/task/${TASK_ID}`,
      {
        headers: {
          'Authorization': config.clickup.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const task = response.data;
    console.log(jarvis.success(`Task found: "${task.name}"`));
    console.log(jarvis.info(`Status: ${colors.bright}${task.status?.status || 'unknown'}${colors.reset}`));

    // Return as array with single task
    return [task];
  } catch (error) {
    console.log(jarvis.error(`Failed to fetch task: ${error.message}`));
    if (error.response) {
      console.log(jarvis.error(`Status code: ${error.response.status}`));
      console.log(jarvis.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`));
    }
    return [];
  }
}

async function updateStatus(taskId, statusId) {
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
    console.log(jarvis.error(`Status update failed: ${error.message}`));
  }
}

async function addComment(taskId, commentText) {
  // Check if comments are disabled
  if (process.env.DISABLE_COMMENTS === 'true') {
    console.log(jarvis.info(`Comment skipped (disabled) for task ${taskId}`));
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
    console.log(jarvis.success(`Comment posted to task ${taskId}`));
    return { success: true, data: response.data };
  } catch (error) {
    console.log(jarvis.error(`Comment failed for task ${taskId}: ${error.message}`));
    if (error.response) {
      console.log(jarvis.error(`Status: ${error.response.status}`));
      console.log(jarvis.error(`Details: ${JSON.stringify(error.response.data)}`));
    }
    return { success: false, error: error.message };
  }
}

/**
 * Get comments for a task
 * @param {string} taskId - ClickUp task ID
 * @returns {Array} Array of comments
 */
async function getTaskComments(taskId) {
  try {
    const response = await axios.get(
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
    console.log(jarvis.error(`Failed to fetch comments for task ${taskId}: ${error.message}`));
    return [];
  }
}

/**
 * Parse command from comment text
 * Supported commands:
 * - "re-run check" or "rerun check" - Re-run Codex review
 * - "re-run fixes" or "rerun fixes" - Re-run Claude fixes
 * @param {string} commentText - Comment text
 * @returns {object|null} Command object or null
 */
function parseCommand(commentText) {
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
 * @param {object} task - ClickUp task object
 * @returns {string|null} Repository name or null for default
 */
function detectRepository(task) {
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

module.exports = {
  getAssignedTasks,
  updateStatus,
  addComment,
  getTaskComments,
  parseCommand,
  detectRepository,
};
