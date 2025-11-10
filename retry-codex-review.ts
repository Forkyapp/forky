#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { forky, colors } from './lib/ui';
import * as storage from './lib/storage';
import * as codex from './lib/codex';
import { RepositoryConfig, resolveRepoConfig } from './lib/config';

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
  console.log(forky.ai(`Retrying Codex review for ${colors.bright}${taskId}${colors.reset}`));

  // Get pipeline state
  const pipelineState = storage.pipeline.get(taskId);

  if (!pipelineState) {
    console.log(forky.error(`Task ${taskId} not found in pipeline state`));
    process.exit(1);
  }

  console.log(forky.info(`Task: ${pipelineState.taskName}`));
  console.log(forky.info(`Current stage: ${pipelineState.currentStage}`));
  console.log(forky.info(`Status: ${pipelineState.status}`));

  // Check if Claude implementation was completed
  const implementingStage = pipelineState.stages.find(s => s.stage === 'implementing');
  if (!implementingStage || implementingStage.status !== 'completed') {
    console.log(forky.error('Claude implementation stage not completed. Cannot run Codex review.'));
    process.exit(1);
  }

  const branch = implementingStage.branch || `task-${taskId}`;
  console.log(forky.info(`Branch: ${branch}`));

  // Detect repository from task metadata or use default
  const repoName = pipelineState.metadata?.repository;
  let repoConfig: RepositoryConfig;

  if (repoName && repoName !== 'default') {
    console.log(forky.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
    repoConfig = resolveRepoConfig(repoName);
  } else {
    console.log(forky.info(`Repository: ${colors.bright}default${colors.reset}`));
    repoConfig = resolveRepoConfig(null);
  }

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

    console.log(forky.success(`${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`));
    console.log(forky.success('✅ Done! You can now continue with Claude fixes if needed.'));

  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Codex review error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);
    console.log(forky.warning('Review failed. Check the error above.'));
    process.exit(1);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

// Get task ID from command line
const taskId = process.argv[2];

if (!taskId) {
  console.log(forky.error('Usage: node retry-codex-review.ts <task-id>'));
  console.log(forky.info('Example: node retry-codex-review.ts 86eveugud'));
  process.exit(1);
}

// Run the retry
retryCodexReview(taskId).catch(error => {
  const err = error as Error;
  console.log(forky.error(`Fatal error: ${err.message}`));
  process.exit(1);
});
