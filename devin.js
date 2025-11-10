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

require('dotenv').config();

const config = require('./lib/config');
const { jarvis, colors } = require('./lib/ui');
const storage = require('./lib/storage');
const clickup = require('./lib/clickup');
const claude = require('./lib/claude');
const orchestrator = require('./lib/orchestrator');

async function checkTaskCommands() {
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
          console.log(jarvis.ai(`Command detected in task ${colors.bright}${task.id}${colors.reset}: ${command.type}`));
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
            console.log(jarvis.error(`Command execution failed: ${error.message}`));
            await clickup.addComment(
              task.id,
              `❌ **Command Failed**\n\n` +
              `Command: \`${command.type}\`\n` +
              `Error: ${error.message}`
            );
          }
        }
      }
    }
  } catch (error) {
    console.log(jarvis.error(`Comment checking error: ${error.message}`));
  }
}

async function pollAndProcess() {
  try {
    console.log(jarvis.divider());
    console.log(jarvis.info(`🔄 Polling for tasks... (${new Date().toLocaleTimeString()})`));

    // First, check for command comments
    await checkTaskCommands();

    // Then process new tasks
    const tasks = await clickup.getAssignedTasks();

    if (tasks.length === 0) {
      console.log(jarvis.info('No tasks with "bot in progress" status found'));
    } else {
      console.log(jarvis.success(`Found ${colors.bright}${tasks.length}${colors.reset} task(s) to process`));
    }

    for (const task of tasks) {
      if (storage.cache.has(task.id)) {
        console.log(jarvis.info(`Skipping task ${colors.bright}${task.id}${colors.reset} - already in cache`));
        continue;
      }

      console.log(`\n${colors.bright}${colors.green}🎯 ${task.id}${colors.reset} • ${task.name}`);
      storage.cache.add(task);

      try {
        // Multi-AI workflow: Gemini → Claude → PR
        const result = await orchestrator.processTask(task);

        if (!result.success) {
          console.log(jarvis.warning(`Task ${task.id} queued for manual processing`));
        }
      } catch (error) {
        console.log(jarvis.error(`Failed: ${error.message}`));
      }
    }

  } catch (error) {
    console.log(jarvis.error(`Polling error: ${error.message}`));
    if (error.stack) {
      console.log(jarvis.error(`Stack trace: ${error.stack}`));
    }
  }
}

// Only run if this file is executed directly (not imported for testing)
if (require.main === module) {
  // Initialize data on startup
  storage.cache.init();
  storage.processedComments.init();

  console.clear();
  console.log('\n' + jarvis.header('J.A.R.V.I.S'));
  console.log(jarvis.ai('Autonomous Task System'));
  console.log(jarvis.divider());

  // Show configuration
  console.log(jarvis.info('Configuration:'));
  console.log(jarvis.info(`  ClickUp Workspace ID: ${colors.bright}${config.clickup.workspaceId}${colors.reset}`));
  console.log(jarvis.info(`  GitHub Repo: ${colors.bright}${config.github.owner}/${config.github.repo}${colors.reset}`));
  console.log(jarvis.info(`  GitHub Repo Path: ${colors.bright}${config.github.repoPath}${colors.reset}`));
  console.log(jarvis.info(`  Poll Interval: ${colors.bright}${config.system.pollIntervalMs / 1000}s${colors.reset}`));
  console.log(jarvis.divider());

  if (!config.github.repoPath || !require('fs').existsSync(config.github.repoPath)) {
    console.log(jarvis.error('Repository path not configured in .env'));
    process.exit(1);
  }

  claude.ensureClaudeSettings();
  console.log(jarvis.success('Systems online'));
  console.log(jarvis.info(`Monitoring workspace • ${config.system.pollIntervalMs / 1000}s intervals`));
  console.log(jarvis.ai('✨ Synchronous Multi-AI Workflow:'));
  console.log(jarvis.info('   1. Gemini Analysis'));
  console.log(jarvis.info('   2. Claude Implementation'));
  console.log(jarvis.info('   3. Codex Code Review'));
  console.log(jarvis.info('   4. Claude Fixes'));
  console.log(jarvis.info('   All in ONE terminal, sequential execution'));
  console.log(jarvis.divider() + '\n');

  // Start polling for new tasks
  pollAndProcess();
  setInterval(pollAndProcess, config.system.pollIntervalMs);

  // Set up shutdown handlers
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

function gracefulShutdown() {
  console.log('\n' + jarvis.ai('Shutting down...'));
  storage.cache.save();
  storage.processedComments.save();
  console.log(jarvis.success('State saved. Goodbye!') + '\n');
  process.exit(0);
}

// Export for testing
module.exports = {
  pollAndProcess,
  gracefulShutdown,
  // Re-export from modules for backward compatibility with tests
  ...storage.queue,
  ...clickup,
  ...claude,
  config,
};
