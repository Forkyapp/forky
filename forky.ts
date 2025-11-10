#!/usr/bin/env node

// Unset any system environment variables that might override .env file
delete process.env.CLICKUP_WORKSPACE_ID;
delete process.env.CLICKUP_API_KEY;
delete process.env.CLICKUP_SECRET;
delete process.env.CLICKUP_BOT_USER_ID;
delete process.env.GITHUB_OWNER;
delete process.env.GITHUB_REPO;
delete process.env.GITHUB_BASE_BRANCH;
delete process.env.GITHUB_REPO_PATH;
delete process.env.GITHUB_TOKEN;
delete process.env.GITHUB_DEFAULT_USERNAME;

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import config from './lib/config';
import { forky, colors } from './lib/ui';
import * as storage from './lib/storage';
import * as clickup from './lib/clickup';
import * as claude from './lib/claude';
import * as orchestrator from './lib/orchestrator';

// ============================================
// INTERFACES
// ============================================

interface ProcessTaskResult {
  success: boolean;
  pipeline?: storage.PipelineData;
  analysis?: any;
  error?: string;
}

// ============================================
// FUNCTIONS
// ============================================

async function checkTaskCommands(): Promise<void> {
  try {
    const tasks = await clickup.getAssignedTasks();

    for (const task of tasks) {
      // Check for command comments on all assigned tasks
      const comments = await clickup.getTaskComments(task.id);

      for (const comment of comments) {
        // Skip if already processed
        if (storage.processedComments.has(comment.id)) continue;

        // Parse command from comment
        const command = clickup.parseCommand(comment.comment_text);

        if (command) {
          console.log(forky.ai(`Command detected in task ${colors.bright}${task.id}${colors.reset}: ${command.type}`));
          storage.processedComments.add(comment.id);

          // Post immediate acknowledgment
          let ackMessage = '';
          if (command.type === 'rerun-codex-review') {
            ackMessage = `🤖 **Command Received: Re-run Codex Review**\n\n` +
              `I'm starting the Codex code review now...\n` +
              `This may take a few minutes. I'll post an update when it's done.`;
          } else if (command.type === 'rerun-claude-fixes') {
            ackMessage = `🤖 **Command Received: Re-run Claude Fixes**\n\n` +
              `I'm starting to fix all TODO/FIXME comments now...\n` +
              `This may take a few minutes. I'll post an update when it's done.`;
          }

          if (ackMessage) {
            await clickup.addComment(task.id, ackMessage);
          }

          try {
            if (command.type === 'rerun-codex-review') {
              await orchestrator.rerunCodexReview(task.id);
            } else if (command.type === 'rerun-claude-fixes') {
              await orchestrator.rerunClaudeFixes(task.id);
            }
          } catch (error) {
            const err = error as Error;
            console.log(forky.error(`Command execution failed: ${err.message}`));
            await clickup.addComment(
              task.id,
              `❌ **Command Failed**\n\n` +
              `Command: \`${command.type}\`\n` +
              `Error: ${err.message}`
            );
          }
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Comment checking error: ${err.message}`));
  }
}

async function pollAndProcess(): Promise<void> {
  try {
    console.log(forky.divider());
    console.log(forky.info(`🔄 Polling for tasks... (${new Date().toLocaleTimeString()})`));

    // First, check for command comments
    await checkTaskCommands();

    // Then process new tasks
    const tasks = await clickup.getAssignedTasks();

    if (tasks.length === 0) {
      console.log(forky.info('No tasks with "bot in progress" status found'));
    } else {
      console.log(forky.success(`Found ${colors.bright}${tasks.length}${colors.reset} task(s) to process`));
    }

    for (const task of tasks) {
      if (storage.cache.has(task.id)) {
        console.log(forky.info(`Skipping task ${colors.bright}${task.id}${colors.reset} - already in cache`));
        continue;
      }

      console.log(`\n${colors.bright}${colors.green}🎯 ${task.id}${colors.reset} • ${task.name}`);
      storage.cache.add(task);

      try {
        // Multi-AI workflow: Gemini → Claude → PR
        const result: ProcessTaskResult = await orchestrator.processTask(task);

        if (!result.success) {
          console.log(forky.warning(`Task ${task.id} queued for manual processing`));
        }
      } catch (error) {
        const err = error as Error;
        console.log(forky.error(`Failed: ${err.message}`));
      }
    }

  } catch (error) {
    const err = error as Error;
    console.log(forky.error(`Polling error: ${err.message}`));
    if (err.stack) {
      console.log(forky.error(`Stack trace: ${err.stack}`));
    }
  }
}

function gracefulShutdown(): void {
  console.log('\n' + forky.ai('Shutting down...'));
  storage.cache.save();
  storage.processedComments.save();
  console.log(forky.success('State saved. Goodbye!') + '\n');
  process.exit(0);
}

// ============================================
// MAIN EXECUTION
// ============================================

// Only run if this file is executed directly (not imported for testing)
if (require.main === module) {
  // Initialize data on startup
  storage.cache.init();
  storage.processedComments.init();

  console.clear();
  console.log('\n' + forky.header('FORKY'));
  console.log(forky.ai('Autonomous Task System'));
  console.log(forky.divider());

  // Show configuration
  console.log(forky.info('Configuration:'));
  console.log(forky.info(`  ClickUp Workspace ID: ${colors.bright}${config.clickup.workspaceId}${colors.reset}`));
  console.log(forky.info(`  GitHub Repo: ${colors.bright}${config.github.owner}/${config.github.repo}${colors.reset}`));
  console.log(forky.info(`  GitHub Repo Path: ${colors.bright}${config.github.repoPath}${colors.reset}`));
  console.log(forky.info(`  Poll Interval: ${colors.bright}${config.system.pollIntervalMs / 1000}s${colors.reset}`));
  console.log(forky.divider());

  if (!config.github.repoPath || !fs.existsSync(config.github.repoPath)) {
    console.log(forky.error('Repository path not configured in .env'));
    process.exit(1);
  }

  claude.ensureClaudeSettings();
  console.log(forky.success('Systems online'));
  console.log(forky.info(`Monitoring workspace • ${config.system.pollIntervalMs / 1000}s intervals`));
  console.log(forky.ai('✨ Synchronous Multi-AI Workflow:'));
  console.log(forky.info('   1. Gemini Analysis'));
  console.log(forky.info('   2. Claude Implementation'));
  console.log(forky.info('   3. Codex Code Review'));
  console.log(forky.info('   4. Claude Fixes'));
  console.log(forky.info('   All in ONE terminal, sequential execution'));
  console.log(forky.divider() + '\n');

  // Start polling for new tasks
  pollAndProcess();
  setInterval(pollAndProcess, config.system.pollIntervalMs);

  // Set up shutdown handlers
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

// Export for testing
export {
  pollAndProcess,
  gracefulShutdown,
  checkTaskCommands
};

// Re-export from modules for backward compatibility with tests
export { cache, queue, tracking, reviewTracking, pipeline, processedComments } from './lib/storage';
export { getAssignedTasks, updateStatus, addComment, getTaskComments, detectRepository, parseCommand } from './lib/clickup';
export { ensureClaudeSettings, launchClaude, fixTodoComments } from './lib/claude';
export { default as config } from './lib/config';
