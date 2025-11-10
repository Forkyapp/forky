#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { jarvis, colors } from './lib/ui';
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
  console.log(jarvis.ai(`Retrying Codex review for ${colors.bright}${taskId}${colors.reset}`));

  // Get pipeline state
  const pipelineState = storage.pipeline.get(taskId);

  if (!pipelineState) {
    console.log(jarvis.error(`Task ${taskId} not found in pipeline state`));
    process.exit(1);
  }

  console.log(jarvis.info(`Task: ${pipelineState.taskName}`));
  console.log(jarvis.info(`Current stage: ${pipelineState.currentStage}`));
  console.log(jarvis.info(`Status: ${pipelineState.status}`));

  // Check if Claude implementation was completed
  const implementingStage = pipelineState.stages.find(s => s.stage === 'implementing');
  if (!implementingStage || implementingStage.status !== 'completed') {
    console.log(jarvis.error('Claude implementation stage not completed. Cannot run Codex review.'));
    process.exit(1);
  }

  const branch = implementingStage.branch || `task-${taskId}`;
  console.log(jarvis.info(`Branch: ${branch}`));

  // Detect repository from task metadata or use default
  const repoName = pipelineState.metadata?.repository;
  let repoConfig: RepositoryConfig;

  if (repoName && repoName !== 'default') {
    console.log(jarvis.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
    repoConfig = resolveRepoConfig(repoName);
  } else {
    console.log(jarvis.info(`Repository: ${colors.bright}default${colors.reset}`));
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

    console.log(jarvis.success(`${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`));
    console.log(jarvis.success('✅ Done! You can now continue with Claude fixes if needed.'));

  } catch (error) {
    const err = error as Error;
    console.log(jarvis.error(`Codex review error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);
    console.log(jarvis.warning('Review failed. Check the error above.'));
    process.exit(1);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

// Get task ID from command line
const taskId = process.argv[2];

if (!taskId) {
  console.log(jarvis.error('Usage: node retry-codex-review.ts <task-id>'));
  console.log(jarvis.info('Example: node retry-codex-review.ts 86eveugud'));
  process.exit(1);
}

// Run the retry
retryCodexReview(taskId).catch(error => {
  const err = error as Error;
  console.log(jarvis.error(`Fatal error: ${err.message}`));
  process.exit(1);
});
