#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { timmy, colors } from './src/shared/ui';
import * as storage from './lib/storage';
import * as codex from './src/core/monitoring/codex.service';
import { RepositoryConfig, resolveRepoConfig } from './src/shared/config';
import { workspace } from './src/core/workspace/workspace.service';

// ============================================
// INTERFACES
// ============================================

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  text_content?: string;
  url?: string;
}

interface ReviewResult {
  success: boolean;
  branch?: string;
  error?: string;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Retry only the Codex review stage for a specific task
 */
async function retryCodexReview(taskId: string): Promise<void> {
  console.log(timmy.ai(`Retrying Codex review for ${colors.bright}${taskId}${colors.reset}`));

  // Get pipeline state
  const pipelineState = storage.pipeline.get(taskId);

  if (!pipelineState) {
    console.log(timmy.error(`Task ${taskId} not found in pipeline state`));
    process.exit(1);
  }

  console.log(timmy.info(`Task: ${pipelineState.taskName}`));
  console.log(timmy.info(`Current stage: ${pipelineState.currentStage}`));
  console.log(timmy.info(`Status: ${pipelineState.status}`));

  // Check if Claude implementation was completed
  const implementingStage = pipelineState.stages.find(s => s.stage === 'implementing');
  if (!implementingStage || implementingStage.status !== 'completed') {
    console.log(timmy.error('Claude implementation stage not completed. Cannot run Codex review.'));
    process.exit(1);
  }

  const branch = implementingStage.branch || `task-${taskId}`;
  console.log(timmy.info(`Branch: ${branch}`));

  // Get repository configuration from active workspace
  const activeProject = workspace.getActiveProject();
  if (!activeProject) {
    console.log(timmy.error('No active project configured. Run: npm run switch <project>'));
    process.exit(1);
  }

  console.log(timmy.info(`Project: ${colors.bright}${activeProject.name}${colors.reset}`));
  console.log(timmy.info(`Repository: ${activeProject.github.owner}/${activeProject.github.repo}`));

  const repoConfig: RepositoryConfig = resolveRepoConfig();

  // Create minimal task object for codex.reviewClaudeChanges
  const task: ClickUpTask = {
    id: taskId,
    name: pipelineState.taskName,
    url: `https://app.clickup.com/t/${taskId}`
  };

  // Update pipeline stage
  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, { name: 'Codex Review (Retry)' });

  try {
    const reviewResult: ReviewResult = await codex.reviewClaudeChanges(task, { repoConfig });

    if (!reviewResult.success) {
      throw new Error(reviewResult.error || 'Codex review failed');
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
      branch: reviewResult.branch
    });

    console.log(timmy.success(`${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`));
    console.log(timmy.success('✅ Done! You can now continue with Claude fixes if needed.'));

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Codex review error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);
    console.log(timmy.warning('Review failed. Check the error above.'));
    process.exit(1);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

// Get task ID from command line
const taskId = process.argv[2];

if (!taskId) {
  console.log(timmy.error('Usage: node retry-codex-review.ts <task-id>'));
  console.log(timmy.info('Example: node retry-codex-review.ts 86eveugud'));
  process.exit(1);
}

// Run the retry
retryCodexReview(taskId).catch(error => {
  const err = error as Error;
  console.log(timmy.error(`Fatal error: ${err.message}`));
  process.exit(1);
});
