import * as clickup from '../../../../lib/clickup';

/**
 * Send workflow completion notification to ClickUp
 */
export async function notifyWorkflowComplete(taskId: string): Promise<void> {
  await clickup.addComment(
    taskId,
    `🎉 **Workflow Complete**\n\n` +
      `Full multi-AI workflow has finished:\n` +
      `✅ Gemini Analysis\n` +
      `✅ Claude Implementation\n` +
      `✅ Codex Review\n` +
      `✅ Claude Fixes\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Ready for review`
  );
}

/**
 * Send Codex rerun completion notification
 */
export async function notifyCodexRerunComplete(
  taskId: string,
  branch: string
): Promise<void> {
  await clickup.addComment(
    taskId,
    `✅ **Codex Review Re-run Complete**\n\n` +
      `Codex has finished re-reviewing the implementation.\n\n` +
      `**Branch:** \`${branch}\`\n` +
      `**Status:** Complete`
  );
}

/**
 * Send Codex rerun failure notification
 */
export async function notifyCodexRerunFailed(
  taskId: string,
  error: string
): Promise<void> {
  await clickup.addComment(
    taskId,
    `❌ **Codex Review Re-run Failed**\n\n` + `Error: ${error}`
  );
}

/**
 * Send Claude fixes rerun completion notification
 */
export async function notifyFixesRerunComplete(taskId: string): Promise<void> {
  await clickup.addComment(
    taskId,
    `✅ **Claude Fixes Re-run Complete**\n\n` +
      `Claude has finished re-addressing TODO/FIXME comments.\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Complete`
  );
}

/**
 * Send Claude fixes rerun failure notification
 */
export async function notifyFixesRerunFailed(
  taskId: string,
  error: string
): Promise<void> {
  await clickup.addComment(
    taskId,
    `❌ **Claude Fixes Re-run Failed**\n\n` + `Error: ${error}`
  );
}
