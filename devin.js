require('dotenv').config();

const config = require('./lib/config');
const { jarvis, colors } = require('./lib/ui');
const storage = require('./lib/storage');
const clickup = require('./lib/clickup');
const claude = require('./lib/claude');
const codex = require('./lib/codex');
const orchestrator = require('./lib/orchestrator');

async function pollAndProcess() {
  try {
    const tasks = await clickup.getAssignedTasks();

    for (const task of tasks) {
      if (storage.cache.has(task.id)) continue;

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
  }
}

// Only run if this file is executed directly (not imported for testing)
if (require.main === module) {
  // Initialize data on startup
  storage.cache.init();
  storage.tracking.init();
  storage.reviewTracking.init();

  console.clear();
  console.log('\n' + jarvis.header('J.A.R.V.I.S'));
  console.log(jarvis.ai('Autonomous Task System'));
  console.log(jarvis.divider());

  if (!config.github.repoPath || !require('fs').existsSync(config.github.repoPath)) {
    console.log(jarvis.error('Repository path not configured in .env'));
    process.exit(1);
  }

  claude.ensureClaudeSettings();
  console.log(jarvis.success('Systems online'));
  console.log(jarvis.info(`Monitoring workspace • ${config.system.pollIntervalMs / 1000}s intervals`));
  console.log(jarvis.ai('Multi-AI workflow: Gemini → Claude → PR → Codex Review → Claude Fixes'));
  console.log(jarvis.info(`Review iterations: Up to 3 cycles`));
  console.log(jarvis.divider() + '\n');

  pollAndProcess();
  setInterval(pollAndProcess, config.system.pollIntervalMs);

  // PR tracking with review workflow callback
  setInterval(() => {
    storage.tracking.poll(clickup, {
      onPRFound: async (prInfo) => {
        console.log(jarvis.ai(`Starting code review workflow for task ${prInfo.taskId}`));

        // Start review cycle tracking
        const task = { id: prInfo.taskId, name: prInfo.taskName };
        storage.reviewTracking.startReviewCycle(task, prInfo);

        // Trigger Codex review
        await codex.reviewClaudeChanges(task);
      }
    });
  }, config.prTracking.checkIntervalMs);

  // Review cycle tracking (polls for Codex review commits and Claude fix commits)
  setInterval(() => {
    storage.reviewTracking.poll(clickup, codex, claude);
  }, config.prTracking.checkIntervalMs);

  // Set up shutdown handlers
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

function gracefulShutdown() {
  console.log('\n' + jarvis.ai('Shutting down...'));
  storage.cache.save();
  storage.tracking.save(storage.tracking.getData());
  storage.reviewTracking.save(storage.reviewTracking.getData());
  console.log(jarvis.success('State saved. Goodbye!') + '\n');
  process.exit(0);
}

// Export for testing
module.exports = {
  pollAndProcess,
  gracefulShutdown,
  // Re-export from modules for backward compatibility with tests
  ...storage.queue,
  ...storage.tracking,
  ...clickup,
  ...claude,
  config,
};
