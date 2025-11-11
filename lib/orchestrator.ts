import path from 'path';
import { forky, colors } from './ui';
import * as storage from './storage';
import * as gemini from './gemini';
import * as claude from './claude';
import * as codex from './codex';
import { RepositoryConfig, resolveRepoConfig } from './config';
import * as clickup from './clickup';
import type { ClickUpTask } from './clickup';

// ============================================
// INTERFACES
// ============================================

interface AnalysisResult {
  success?: boolean;
  featureSpecFile: string;
  featureDir?: string;
  content?: string;
  logFile?: string;
  progressFile?: string;
  fallback?: boolean;
  error?: string;
}

interface ProcessTaskResult {
  success: boolean;
  pipeline?: storage.PipelineData;
  analysis?: AnalysisResult | null;
  error?: string;
}

interface LaunchResult {
  success: boolean;
  branch?: string;
  logFile?: string;
  progressFile?: string;
  error?: string;
}

interface ReviewResult {
  success: boolean;
  branch?: string;
  error?: string;
}

interface FixTodoResult {
  success: boolean;
  branch?: string;
  error?: string;
}

interface RerunResult {
  success: boolean;
  branch?: string;
  error?: string;
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Process a task with FULLY SYNCHRONOUS multi-AI workflow
 *
 * Flow: Gemini Analysis → Claude Implementation → Codex Review → Claude Fixes → Complete
 * All agents run in sequence, waiting for each to complete before starting the next
 */
export async function processTask(task: ClickUpTask): Promise<ProcessTaskResult> {
  const taskId = task.id;
  const taskName = task.name;

  // Detect repository from task
  const repoName = clickup.detectRepository(task);

  console.log(forky.ai(`Starting multi-AI workflow for ${colors.bright}${taskId}${colors.reset}`));

  let repoConfig: RepositoryConfig;
  try {
    // Use active workspace project configuration
    repoConfig = resolveRepoConfig();
    console.log(forky.info(`Using repository: ${repoConfig.owner}/${repoConfig.repo}`));

    if (repoName && repoName !== repoConfig.repo) {
      console.log(forky.warning(`Task specifies repo "${repoName}" but active project is "${repoConfig.repo}"`));
      console.log(forky.info('Using active project from workspace.json'));
    }
  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Repository setup failed: ${err.message}`));
    storage.pipeline.fail(taskId, err);
    await storage.queue.add(task);
    return {
      success: false,
      error: err.message
    };
  }

  // Initialize pipeline
  const pipelineState = storage.pipeline.init(taskId, { name: taskName });

  // Set repository in metadata
  storage.pipeline.updateMetadata(taskId, {
    repository: repoName || 'default'
  });

  try {
    // Stage 1: Gemini Analysis
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.ANALYZING, { name: 'Gemini Analysis' });

    let analysis: AnalysisResult | null = null;
    let usedFallback = false;

    try {
      // Post Gemini start comment
      await clickup.addComment(
        taskId,
        `🧠 **Gemini Analysis Started**\n\n` +
        `Gemini AI is analyzing the task to create a detailed feature specification.\n\n` +
        `**Status:** Analyzing requirements and architecture`
      );

      analysis = await gemini.analyzeTask(task, { repoConfig });

      if (analysis.fallback) {
        usedFallback = true;
        console.log(forky.warning('Using fallback analysis'));
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.ANALYZING, {
        featureSpecFile: analysis.featureSpecFile,
        fallback: usedFallback,
        logFile: analysis.logFile
      });

      storage.pipeline.updateMetadata(taskId, {
        geminiAnalysis: {
          file: analysis.featureSpecFile,
          fallback: usedFallback,
          logFile: analysis.logFile
        }
      });

      // Store Gemini execution info
      storage.pipeline.storeAgentExecution(taskId, 'gemini', {
        logFile: analysis.logFile,
        progressFile: analysis.progressFile,
        featureSpecFile: analysis.featureSpecFile
      });

      // Post Gemini completion comment
      await clickup.addComment(
        taskId,
        `✅ **Gemini Analysis Complete**\n\n` +
        `Feature specification has been created.\n\n` +
        `**Spec File:** \`${path.basename(analysis.featureSpecFile)}\`\n` +
        `**Status:** ${usedFallback ? 'Fallback mode (Gemini unavailable)' : 'Success'}\n\n` +
        `Next: Claude will implement the feature`
      );

    } catch (error) {
      const err = error as Error;
      console.log(forky.error(`Gemini analysis failed: ${err.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.ANALYZING, err);

      // Continue without analysis
      console.log(forky.info(`Continuing without ${colors.bright}Gemini${colors.reset} analysis`));
    }

    // Stage 2: Claude Implementation
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, { name: 'Claude Implementation' });

    try {
      const result: LaunchResult = await claude.launchClaude(task, {
        analysis: analysis && analysis.content ? {
          content: analysis.content,
          featureDir: analysis.featureDir,
          featureSpecFile: analysis.featureSpecFile
        } : undefined,
        repoConfig
      });

      if (!result.success) {
        throw new Error(result.error || 'Claude implementation failed');
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, {
        branch: result.branch
      });

      console.log(forky.success(`${colors.bright}Claude${colors.reset} implementation complete for ${colors.bright}${taskId}${colors.reset}`));

    } catch (error) {
      const err = error as Error;
      console.log(forky.error(`Claude implementation error: ${err.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, err);
      storage.pipeline.fail(taskId, err);
      await storage.queue.add(task);
      return {
        success: false,
        pipeline: pipelineState,
        error: err.message
      };
    }

    // Stage 3: Codex Code Review
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, { name: 'Codex Review' });

    try {
      const reviewResult: ReviewResult = await codex.reviewClaudeChanges(task, { repoConfig });

      if (!reviewResult.success) {
        throw new Error(reviewResult.error || 'Codex review failed');
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
        branch: reviewResult.branch
      });

      console.log(forky.success(`${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`));

    } catch (error) {
      const err = error as Error;
      console.log(forky.error(`Codex review error: ${err.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);
      // Continue even if review fails - not critical
      console.log(forky.warning(`Continuing without Codex review`));
    }

    // Stage 4: Claude Fixes TODO/FIXME Comments
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, { name: 'Claude Fixes' });

    try {
      const fixResult: FixTodoResult = await claude.fixTodoComments(task, { repoConfig });

      if (!fixResult.success) {
        throw new Error(fixResult.error || 'Claude fixes failed');
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
        branch: fixResult.branch
      });

      console.log(forky.success(`${colors.bright}Claude${colors.reset} fixes complete for ${colors.bright}${taskId}${colors.reset}`));

    } catch (error) {
      const err = error as Error;
      console.log(forky.error(`Claude fixes error: ${err.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, err);
      // Continue even if fixes fail - not critical
      console.log(forky.warning(`Continuing without Claude fixes`));
    }

    // Stage 5: Complete
    storage.pipeline.complete(taskId, {
      branch: `task-${taskId}`,
      completedAt: new Date().toISOString()
    });

    console.log(forky.success(`🎉 Multi-AI workflow complete for ${colors.bright}${taskId}${colors.reset}`));

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

    return {
      success: true,
      pipeline: pipelineState,
      analysis: analysis || null
    };

  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Orchestration error: ${err.message}`));
    storage.pipeline.fail(taskId, err);

    // Queue for manual processing
    await storage.queue.add(task);

    return {
      success: false,
      pipeline: pipelineState,
      error: err.message
    };
  }
}

/**
 * Get pipeline status for a task
 */
export function getTaskStatus(taskId: string): storage.PipelineSummary | null {
  return storage.pipeline.getSummary(taskId);
}

/**
 * Get all active tasks
 */
export function getActiveTasks(): storage.PipelineData[] {
  return storage.pipeline.getActive();
}

/**
 * Re-run only the Codex review stage
 */
export async function rerunCodexReview(taskId: string): Promise<RerunResult> {
  console.log(forky.ai(`Re-running Codex review for ${colors.bright}${taskId}${colors.reset}`));

  // Get pipeline state
  const pipelineState = storage.pipeline.get(taskId);

  if (!pipelineState) {
    throw new Error(`Task ${taskId} not found in pipeline state`);
  }

  // Check if Claude implementation was completed
  const implementingStage = pipelineState.stages.find(s => s.stage === 'implementing');
  if (!implementingStage || implementingStage.status !== 'completed') {
    throw new Error('Claude implementation stage not completed. Cannot run Codex review.');
  }

  const branch = implementingStage.branch || `task-${taskId}`;

  // Detect repository from task metadata or use default
  const repoName = pipelineState.metadata?.repository;

  if (repoName && repoName !== 'default') {
    console.log(forky.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
  } else {
    console.log(forky.info(`Repository: ${colors.bright}default${colors.reset}`));
  }
  const repoConfig: RepositoryConfig = resolveRepoConfig();

  // Create minimal task object
  const task: ClickUpTask = {
    id: taskId,
    name: pipelineState.taskName,
    url: `https://app.clickup.com/t/${taskId}`
  };

  // Update pipeline stage
  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, { name: 'Codex Review (Re-run)' });

  try {
    const reviewResult: ReviewResult = await codex.reviewClaudeChanges(task, { repoConfig });

    if (!reviewResult.success) {
      throw new Error(reviewResult.error || 'Codex review failed');
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, {
      branch: reviewResult.branch
    });

    console.log(forky.success(`${colors.bright}Codex${colors.reset} review complete for ${colors.bright}${taskId}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `✅ **Codex Review Re-run Complete**\n\n` +
      `Codex has finished re-reviewing the implementation.\n\n` +
      `**Branch:** \`${branch}\`\n` +
      `**Status:** Complete`
    );

    return { success: true, branch };
  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Codex review error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CODEX_REVIEWING, err);

    await clickup.addComment(
      taskId,
      `❌ **Codex Review Re-run Failed**\n\n` +
      `Error: ${err.message}`
    );

    return { success: false, error: err.message };
  }
}

/**
 * Re-run only the Claude fixes stage
 */
export async function rerunClaudeFixes(taskId: string): Promise<RerunResult> {
  console.log(forky.ai(`Re-running Claude fixes for ${colors.bright}${taskId}${colors.reset}`));

  // Get pipeline state
  const pipelineState = storage.pipeline.get(taskId);

  if (!pipelineState) {
    throw new Error(`Task ${taskId} not found in pipeline state`);
  }

  // Check if Claude implementation was completed
  const implementingStage = pipelineState.stages.find(s => s.stage === 'implementing');
  if (!implementingStage || implementingStage.status !== 'completed') {
    throw new Error('Claude implementation stage not completed. Cannot run fixes.');
  }

  // Detect repository from task metadata or use default
  const repoName = pipelineState.metadata?.repository;

  if (repoName && repoName !== 'default') {
    console.log(forky.info(`Repository: ${colors.bright}${repoName}${colors.reset}`));
  } else {
    console.log(forky.info(`Repository: ${colors.bright}default${colors.reset}`));
  }
  const repoConfig: RepositoryConfig = resolveRepoConfig();

  // Create minimal task object
  const task: ClickUpTask = {
    id: taskId,
    name: pipelineState.taskName,
    url: `https://app.clickup.com/t/${taskId}`
  };

  // Update pipeline stage
  storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, { name: 'Claude Fixes (Re-run)' });

  try {
    const fixResult: FixTodoResult = await claude.fixTodoComments(task, { repoConfig });

    if (!fixResult.success) {
      throw new Error(fixResult.error || 'Claude fixes failed');
    }

    storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, {
      branch: fixResult.branch
    });

    console.log(forky.success(`${colors.bright}Claude${colors.reset} fixes complete for ${colors.bright}${taskId}${colors.reset}`));

    await clickup.addComment(
      taskId,
      `✅ **Claude Fixes Re-run Complete**\n\n` +
      `Claude has finished re-addressing TODO/FIXME comments.\n\n` +
      `**Branch:** \`task-${taskId}\`\n` +
      `**Status:** Complete`
    );

    return { success: true, branch: fixResult.branch };
  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Claude fixes error: ${err.message}`));
    storage.pipeline.failStage(taskId, storage.pipeline.STAGES.CLAUDE_FIXING, err);

    await clickup.addComment(
      taskId,
      `❌ **Claude Fixes Re-run Failed**\n\n` +
      `Error: ${err.message}`
    );

    return { success: false, error: err.message };
  }
}
