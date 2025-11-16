#!/usr/bin/env node

// Register tsconfig paths for runtime
import 'tsconfig-paths/register';

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
import { logger } from './src/shared/utils/logger.util';
import { setupInteractiveMode, type AppState } from './src/shared/interactive-cli';
import * as storage from './lib/storage';
import * as clickup from './lib/clickup';
import * as claude from './src/core/ai-services/claude.service';
import * as orchestrator from './src/core/orchestrator/orchestrator.service';
import { discordService } from './src/core/discord/discord.service';
import { getProcessManager } from './src/shared/utils/process-manager.util';

// ============================================
// INTERFACES
// ============================================

interface ProcessTaskResult {
  success: boolean;
  pipeline?: storage.PipelineData;
  analysis?: { content?: string; file?: string } | unknown;
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

async function gracefulShutdown(): Promise<void> {
  appState.isRunning = false;

  if (appState.pollInterval) {
    clearInterval(appState.pollInterval);
  }

  console.log('\n' + timmy.doubleDivider());
  console.log(timmy.warning('Shutting down gracefully...'));
  console.log(timmy.divider());

  // Kill all tracked child processes (Claude, etc.)
  const processManager = getProcessManager();
  const activeProcessCount = processManager.getActiveCount();

  if (activeProcessCount > 0) {
    console.log(timmy.warning(`Terminating ${activeProcessCount} active process(es)...`));
    processManager.killAll('SIGTERM');

    // Wait 2 seconds for processes to terminate gracefully
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force kill any remaining processes
    if (processManager.getActiveCount() > 0) {
      console.log(timmy.warning('Force killing remaining processes...'));
      processManager.killAll('SIGKILL');
    }

    console.log(timmy.success('All child processes terminated'));
  }

  // Stop Discord polling and disconnect client
  if (config.discord.enabled) {
    try {
      await discordService.shutdown();
      console.log(timmy.success('Discord client disconnected'));
    } catch (error) {
      const err = error as Error;
      console.log(timmy.warning(`Failed to disconnect Discord: ${err.message}`));
    }
  }

  // Clean up all active worktrees
  if (config.github.repoPath) {
    try {
      const { getWorktreeManager } = await import('./src/core/workspace/worktree-manager.service');
      const worktreeManager = getWorktreeManager(config.github.repoPath);

      console.log(timmy.info('Cleaning up active worktrees...'));
      await worktreeManager.cleanupStaleWorktrees(config.github.repoPath, 0); // Clean all worktrees
      console.log(timmy.success('Worktrees cleaned up'));
    } catch (error) {
      const err = error as Error;
      console.log(timmy.warning(`Failed to cleanup worktrees: ${err.message}`));
    }
  }

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
  (async () => {
    // Initialize data on startup
    storage.cache.init();
    storage.processedComments.init();

    // Context orchestrator will be lazy-initialized on first use
    // (no need to initialize at startup, saves 5-10 seconds!)

    console.clear();
    console.log(timmy.banner());
    console.log('');

    // Validate configuration
    if (!config.github.repoPath || !fs.existsSync(config.github.repoPath)) {
      console.log(timmy.error('Repository path not configured in .env'));
      process.exit(1);
    }

    claude.ensureClaudeSettings();

    // Initialize Discord asynchronously (non-blocking)
    let discordStatus: 'online' | 'offline' | 'idle' = 'offline';
    if (config.discord.enabled) {
      discordStatus = 'idle'; // Connecting in background

      // Start Discord initialization in the background (don't await)
      discordService.init()
        .then(() => {
          // Register event handler for detected messages
          discordService.on({
            onMessageDetected: async (analyzedMessage) => {

              // Create ClickUp task from Discord message
              const { createTaskFromDiscordMessage } = await import('./src/core/discord/discord-clickup-bridge');
              const result = await createTaskFromDiscordMessage(analyzedMessage);

              if (result.success && result.task) {
                // Send minimal Discord response
                try {
                  const client = (discordService as any).client;
                  if (client && result.task.url) {
                    await client.sendMessage(
                      analyzedMessage.message.channelId,
                      `✅ Task created: ${result.task.url}`
                    );
                  }
                } catch (err) {
                  logger.error('Failed to send Discord confirmation', err instanceof Error ? err : new Error(String(err)));
                }
              } else if (result.error) {
                logger.error('Discord task creation failed', new Error(result.error));
              }
            },

            onError: (error: Error) => {
              console.log(timmy.error(`✗ Discord error: ${error.message}`));
            },

            onReady: () => {
              console.log(timmy.success('✓ Discord bot connected and monitoring'));
            },
          });

          discordService.startPolling();
        })
        .catch((error: Error) => {
          console.log(timmy.error(`✗ Discord connection failed: ${error.message}`));
        });
    }

    // System Configuration Card
    console.log(timmy.card('⚙️  System Configuration', [
      { key: 'ClickUp Workspace', value: config.clickup.workspaceId || 'Not configured', icon: '📋' },
      { key: 'GitHub Repository', value: `${config.github.owner}/${config.github.repo}`, icon: '📦' },
      { key: 'Repository Path', value: config.github.repoPath.replace(/^\/Users\/[^/]+/, '~'), icon: '📁' },
      { key: 'Poll Interval', value: `${config.system.pollIntervalMs / 1000}s`, icon: '⏱️' },
      { key: 'Context Mode', value: config.context.mode + (config.context.openaiApiKey ? ' (RAG enabled)' : ' (Smart Loader)'), icon: '🧠' }
    ]));
    console.log('');

    // System Status Section
    console.log(timmy.section('🚀 System Status'));
    console.log(timmy.statusIndicator('MONITORING', 'online', `Polling workspace every ${config.system.pollIntervalMs / 1000}s`));
    console.log(timmy.statusIndicator('TASK QUEUE', 'idle', 'Waiting for tasks marked "bot in progress"'));
    if (config.discord.enabled) {
      console.log(timmy.statusIndicator('DISCORD BOT', discordStatus, discordStatus === 'idle' ? 'Connecting in background...' : 'Disabled'));
    }
    console.log('');

    // Multi-AI Pipeline
    console.log(timmy.section('🤖 Multi-AI Pipeline'));
    console.log(timmy.pipeline([
      { label: 'Gemini Analysis', color: 'magenta' },
      { label: 'Claude Implementation', color: 'blue' },
      { label: 'Codex Review', color: 'yellow' },
      { label: 'Claude Fixes', color: 'green' }
    ]));
    console.log('');

    console.log(timmy.doubleDivider());
    console.log('');
    console.log(timmy.info('Type "help" for available commands'));
    console.log('');

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
  process.on('SIGQUIT', gracefulShutdown);
  })().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
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
