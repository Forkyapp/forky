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
import config from './src/shared/config';
import { timmy, colors } from './src/shared/ui';
import { setupInteractiveMode, type AppState } from './src/shared/interactive-cli';
import * as storage from './lib/storage';
import * as clickup from './lib/clickup';
import * as claude from './src/core/ai-services/claude.service';
import * as orchestrator from './src/core/orchestrator/orchestrator.service';

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
// STATE
// ============================================

const appState: AppState = {
  isRunning: true,
  pollInterval: null,
  isProcessing: false,
  currentTask: null
};

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
          console.log('\n' + timmy.ai(`Command detected: ${colors.bright}${command.type}${colors.reset} (Task ${task.id})`));
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
            console.log(timmy.error(`Command execution failed: ${err.message}`));
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
    console.log(timmy.error(`Comment checking error: ${err.message}`));
  }
}

async function pollAndProcess(): Promise<void> {
  if (!appState.isRunning) return;

  try {
    // First, check for command comments
    await checkTaskCommands();

    // Then process new tasks
    const tasks = await clickup.getAssignedTasks();

    for (const task of tasks) {
      if (!appState.isRunning) {
        console.log(timmy.warning('Polling stopped by user'));
        return;
      }

      if (storage.cache.has(task.id)) {
        continue;
      }

      // Enhanced task header - only show when processing
      console.log('\n' + timmy.doubleDivider());
      console.log(timmy.section(`🎯 Task: ${task.id}`));
      console.log(`  ${timmy.label('Name', task.name)}`);
      console.log(timmy.divider());

      storage.cache.add(task);
      appState.isProcessing = true;
      appState.currentTask = task.id;

      try {
        // Multi-AI workflow: Gemini → Claude → PR
        const result: ProcessTaskResult = await orchestrator.processTask(task);

        if (!result.success) {
          console.log(timmy.warning(`Task queued for manual processing`));
        }
      } catch (error) {
        const err = error as Error;
        console.log(timmy.error(`Task processing failed: ${err.message}`));
      } finally {
        appState.isProcessing = false;
        appState.currentTask = null;
      }
    }

  } catch (error) {
    const err = error as Error;
    console.log(timmy.error(`Polling error: ${err.message}`));
    if (err.stack) {
      console.log(timmy.error(`Stack trace: ${err.stack}`));
    }
  }
}

function gracefulShutdown(): void {
  appState.isRunning = false;

  if (appState.pollInterval) {
    clearInterval(appState.pollInterval);
  }

  console.log('\n' + timmy.doubleDivider());
  console.log(timmy.warning('Shutting down gracefully...'));
  console.log(timmy.divider());

  storage.cache.save();
  storage.processedComments.save();

  console.log(timmy.success('State saved successfully'));
  console.log(timmy.ai('Goodbye! 👋'));
  console.log(timmy.doubleDivider() + '\n');

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
  console.log(timmy.banner());

  // Show configuration with sections
  console.log(timmy.section('⚙️  System Configuration'));
  console.log(timmy.label('  ClickUp Workspace', config.clickup.workspaceId || 'Not configured'));
  console.log(timmy.label('  GitHub Repository', `${config.github.owner}/${config.github.repo}`));
  console.log(timmy.label('  Repository Path', config.github.repoPath || 'Not configured'));
  console.log(timmy.label('  Poll Interval', `${config.system.pollIntervalMs / 1000}s`));
  console.log('');

  if (!config.github.repoPath || !fs.existsSync(config.github.repoPath)) {
    console.log(timmy.error('Repository path not configured in .env'));
    process.exit(1);
  }

  claude.ensureClaudeSettings();

  // Status indicators
  console.log(timmy.section('🚀 System Status'));
  console.log(`  ${timmy.badge('ONLINE', 'green')} ${colors.gray}Monitoring workspace${colors.reset}`);
  console.log(`  ${timmy.badge('QUIET', 'cyan')} ${colors.gray}Silent polling every ${config.system.pollIntervalMs / 1000}s${colors.reset}`);
  console.log('');

  // Workflow overview
  console.log(timmy.section('🤖 Multi-AI Pipeline'));
  console.log(`  ${colors.cyan}1${colors.reset} ${colors.gray}→${colors.reset} ${colors.magenta}Gemini Analysis${colors.reset} ${colors.gray}→${colors.reset} ${colors.cyan}2${colors.reset} ${colors.gray}→${colors.reset} ${colors.blue}Claude Implementation${colors.reset} ${colors.gray}→${colors.reset} ${colors.cyan}3${colors.reset} ${colors.gray}→${colors.reset} ${colors.yellow}Codex Review${colors.reset} ${colors.gray}→${colors.reset} ${colors.cyan}4${colors.reset} ${colors.gray}→${colors.reset} ${colors.green}Claude Fixes${colors.reset}`);
  console.log(timmy.doubleDivider() + '\n');

  // Interactive mode hint
  console.log(timmy.info('Type "help" for available commands\n'));

  // Set up interactive command interface
  const rl = setupInteractiveMode(
    appState,
    pollAndProcess,
    config.system.pollIntervalMs,
    gracefulShutdown
  );

  // Start polling for new tasks
  pollAndProcess();
  appState.pollInterval = setInterval(pollAndProcess, config.system.pollIntervalMs);

  // Display initial prompt
  rl.prompt();

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
export { ensureClaudeSettings, launchClaude, fixTodoComments } from './src/core/ai-services/claude.service';
export { default as config } from './src/shared/config';
