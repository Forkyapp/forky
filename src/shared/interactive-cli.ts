import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { timmy, colors } from './ui';
import * as storage from '../../lib/storage';
import { discordService } from '@/core/discord/discord.service';
import { getContextOrchestrator } from '@/core/context/context-orchestrator';
import config from './config';
import { setVerboseMode } from './utils/verbose.util';

// ============================================
// INTERFACES
// ============================================

export interface AppState {
  isRunning: boolean;
  pollInterval: NodeJS.Timeout | null;
  isProcessing: boolean;
  currentTask: string | null;
  verbose: boolean;
}

// ============================================
// COMMAND HANDLERS
// ============================================

export function handleCommand(
  command: string,
  appState: AppState,
  pollCallback: () => Promise<void>,
  pollIntervalMs: number,
  shutdownCallback: () => void
): void {
  const cmd = command.trim().toLowerCase();

  switch (cmd) {
    case 'help':
    case 'h':
      console.log('\n' + timmy.section('📖 Available Commands'));
      console.log('\n' + `${colors.bright}${colors.cyan}System Control${colors.reset}`);
      console.log(`  ${timmy.label('status, s', 'Show overall system status')}`);
      console.log(`  ${timmy.label('stop', 'Stop polling (keeps app running)')}`);
      console.log(`  ${timmy.label('start', 'Resume polling')}`);
      console.log(`  ${timmy.label('verbose [on|off]', 'Toggle verbose logging mode')}`);
      console.log(`  ${timmy.label('clear, cls', 'Clear terminal screen')}`);
      console.log(`  ${timmy.label('quit, q, exit', 'Exit application')}`);

      console.log('\n' + `${colors.bright}${colors.cyan}Information${colors.reset}`);
      console.log(`  ${timmy.label('logs [taskId]', 'View logs (current task or specific task)')}`);
      console.log(`  ${timmy.label('discord', 'Show Discord bot status and stats')}`);
      console.log(`  ${timmy.label('context', 'Show context loading statistics')}`);
      console.log(`  ${timmy.label('cache', 'Show cached tasks')}`);
      console.log(`  ${timmy.label('stats', 'Show detailed system statistics')}`);

      console.log('\n' + `${colors.bright}${colors.cyan}Management${colors.reset}`);
      console.log(`  ${timmy.label('cache clear', 'Clear task cache')}`);
      console.log(`  ${timmy.label('context clear', 'Clear embeddings cache')}`);
      console.log(`  ${timmy.label('worktree clean', 'Remove all Timmy worktrees')}`);
      console.log(`  ${timmy.label('discord test', 'Send test message to Discord')}`);

      console.log(timmy.divider() + '\n');
      break;

    case 'status':
    case 's':
      console.log('\n' + timmy.section('📊 System Status'));
      console.log(`  ${timmy.label('Polling', appState.isRunning ? timmy.badge('ACTIVE', 'green') : timmy.badge('STOPPED', 'red'))}`);
      console.log(`  ${timmy.label('Processing', appState.isProcessing ? timmy.badge('YES', 'yellow') : timmy.badge('NO', 'cyan'))}`);
      if (appState.currentTask) {
        console.log(`  ${timmy.label('Current Task', appState.currentTask)}`);
      }
      console.log(`  ${timmy.label('Cached Tasks', storage.cache.getIds().size.toString())}`);
      console.log(timmy.divider() + '\n');
      break;

    case 'stop':
      if (!appState.isRunning) {
        console.log(timmy.warning('Polling is already stopped'));
      } else {
        appState.isRunning = false;
        if (appState.pollInterval) {
          clearInterval(appState.pollInterval);
          appState.pollInterval = null;
        }
        console.log(timmy.success('Polling stopped. Type "start" to resume.'));
      }
      break;

    case 'start':
      if (appState.isRunning && appState.pollInterval) {
        console.log(timmy.warning('Polling is already running'));
      } else {
        appState.isRunning = true;
        appState.pollInterval = setInterval(pollCallback, pollIntervalMs);
        console.log(timmy.success('Polling resumed'));
        pollCallback(); // Run immediately
      }
      break;

    case 'quit':
    case 'q':
    case 'exit':
      if (appState.isProcessing) {
        console.log(timmy.warning(`Task ${appState.currentTask} is still processing. Are you sure?`));
        console.log(timmy.info('Type "quit" again to force exit, or wait for task to complete.'));
        if (cmd === 'quit') {
          shutdownCallback();
        }
      } else {
        shutdownCallback();
      }
      break;

    case 'clear':
    case 'cls':
      console.clear();
      console.log(timmy.banner());
      console.log(timmy.info('Terminal cleared\n'));
      break;

    case 'cache': {
      console.log('\n' + timmy.section('📦 Cached Tasks'));
      const cachedTasks = storage.cache.getData();
      if (cachedTasks.length === 0) {
        console.log(timmy.info('No cached tasks'));
      } else {
        cachedTasks.forEach((task) => {
          console.log(`  ${colors.cyan}${task.id}${colors.reset} - ${colors.dim}${task.title}${colors.reset}`);
        });
        console.log(`\n  ${timmy.label('Total', cachedTasks.length.toString())}`);
      }
      console.log(timmy.divider() + '\n');
      break;
    }

    case 'cache clear': {
      const count = storage.cache.getIds().size;

      try {
        // Clear in-memory cache and delete file
        if (fs.existsSync(config.files.cacheFile)) {
          fs.unlinkSync(config.files.cacheFile);
        }
        console.log(timmy.success(`✓ Cleared ${count} cached tasks`));
        console.log(timmy.info('Restart the app to reset the cache'));
      } catch (error) {
        console.log(timmy.error(`Failed to clear cache: ${(error as Error).message}`));
      }
      break;
    }

    case 'discord': {
      console.log('\n' + timmy.section('💬 Discord Bot Status'));

      if (!config.discord.enabled) {
        console.log(timmy.info('Discord integration is disabled'));
        console.log(timmy.divider() + '\n');
        break;
      }

      try {
        const stats = discordService.getStats();
        console.log(`  ${timmy.label('Total Messages Processed', stats.totalProcessed.toString())}`);
        console.log(`  ${timmy.label('Processed Today', stats.processedToday.toString())}`);
        console.log(`  ${timmy.label('Matched Today', stats.matchedToday.toString())}`);
        console.log(`  ${timmy.label('Channels Monitoring', config.discord.channelIds.length.toString())}`);
        console.log(`  ${timmy.label('Poll Interval', `${config.discord.pollIntervalMs / 1000}s`)}`);
        console.log(`  ${timmy.label('Keywords', config.discord.keywords.join(', '))}`);
        console.log(timmy.divider() + '\n');
      } catch {
        console.log(timmy.error('Failed to get Discord stats'));
        console.log(timmy.divider() + '\n');
      }
      break;
    }

    case 'discord test': {
      if (!config.discord.enabled) {
        console.log(timmy.warning('Discord integration is disabled'));
        break;
      }

      console.log(timmy.processing('Sending test message to Discord...'));
      discordService.sendTestMessage().then(() => {
        console.log(timmy.success('✓ Test message sent'));
      }).catch((error: Error) => {
        console.log(timmy.error(`Failed to send test message: ${error.message}`));
      });
      break;
    }

    case 'context': {
      console.log('\n' + timmy.section('🧠 Context Loading Statistics'));

      try {
        const orchestrator = getContextOrchestrator();
        const stats = orchestrator.getStats();

        console.log(`  ${timmy.label('Total Loads', stats.totalLoads.toString())}`);
        console.log(`  ${timmy.label('RAG Loads', `${stats.ragLoads} (${stats.ragPercentage.toFixed(1)}%)`)}`);
        console.log(`  ${timmy.label('Smart Loader Loads', `${stats.smartLoads} (${(100 - stats.ragPercentage).toFixed(1)}%)`)}`);
        console.log(`  ${timmy.label('Avg Load Time', `${stats.avgLoadTimeMs}ms`)}`);
        console.log(`  ${timmy.label('Cache Hit Rate', `${stats.cacheHitRate}%`)}`);
        console.log(`  ${timmy.label('Avg Chunks Returned', stats.avgChunksReturned.toString())}`);
      } catch {
        console.log(timmy.info('Context orchestrator not initialized yet'));
        console.log(timmy.dim('(Will initialize on first context load)'));
      }

      console.log(timmy.divider() + '\n');
      break;
    }

    case 'context clear': {
      const cachePath = path.join(process.cwd(), 'data', 'cache', 'embeddings-cache.json');

      try {
        if (fs.existsSync(cachePath)) {
          fs.unlinkSync(cachePath);
          console.log(timmy.success('✓ Cleared embeddings cache'));
          console.log(timmy.info('Next context load will regenerate embeddings'));
        } else {
          console.log(timmy.info('No embeddings cache found'));
        }
      } catch (error) {
        console.log(timmy.error(`Failed to clear cache: ${(error as Error).message}`));
      }
      break;
    }

    case 'stats': {
      console.log('\n' + timmy.section('📊 Detailed System Statistics'));

      // Task statistics
      const cachedTaskCount = storage.cache.getIds().size;
      const pendingTasks = storage.queue.getPending();
      const completedTasks = storage.queue.getCompleted();

      console.log(`\n${colors.bright}${colors.cyan}Tasks${colors.reset}`);
      console.log(`  ${timmy.label('Cached Tasks', cachedTaskCount.toString())}`);
      console.log(`  ${timmy.label('Queue Pending', pendingTasks.length.toString())}`);
      console.log(`  ${timmy.label('Queue Completed', completedTasks.length.toString())}`);

      // System configuration
      console.log(`\n${colors.bright}${colors.cyan}Configuration${colors.reset}`);
      console.log(`  ${timmy.label('Poll Interval', `${config.system.pollIntervalMs / 1000}s`)}`);
      console.log(`  ${timmy.label('Context Mode', config.context.mode)}`);
      console.log(`  ${timmy.label('RAG Enabled', config.context.openaiApiKey ? 'Yes' : 'No')}`);
      console.log(`  ${timmy.label('Discord Enabled', config.discord.enabled ? 'Yes' : 'No')}`);
      console.log(`  ${timmy.label('Verbose Mode', appState.verbose ? 'On' : 'Off')}`);

      // Runtime statistics
      console.log(`\n${colors.bright}${colors.cyan}Runtime${colors.reset}`);
      console.log(`  ${timmy.label('Polling', appState.isRunning ? 'Active' : 'Stopped')}`);
      console.log(`  ${timmy.label('Processing', appState.isProcessing ? 'Yes' : 'No')}`);
      if (appState.currentTask) {
        console.log(`  ${timmy.label('Current Task', appState.currentTask)}`);
      }

      console.log(timmy.divider() + '\n');
      break;
    }

    case 'verbose':
    case 'verbose on':
    case 'verbose off': {
      if (cmd === 'verbose') {
        // Toggle
        appState.verbose = !appState.verbose;
      } else if (cmd === 'verbose on') {
        appState.verbose = true;
      } else {
        appState.verbose = false;
      }

      // Sync with global verbose mode
      setVerboseMode(appState.verbose);

      console.log(timmy.success(`Verbose mode ${appState.verbose ? 'enabled' : 'disabled'}`));
      if (!appState.verbose) {
        console.log(timmy.info('Only essential logs will be shown. Use "logs" command to view detailed logs.'));
      }
      break;
    }

    case 'logs': {
      const taskId = appState.currentTask;
      if (!taskId) {
        console.log(timmy.warning('No active task. Specify task ID: logs <taskId>'));
        break;
      }

      const logsDir = path.join(process.cwd(), 'src', 'core', 'logs');
      const logFiles = [
        path.join(logsDir, `${taskId}-claude.log`),
        path.join(logsDir, `${taskId}-claude-fixes.log`)
      ];

      let foundLogs = false;
      for (const logFile of logFiles) {
        if (fs.existsSync(logFile)) {
          console.log('\n' + timmy.section(`📋 ${path.basename(logFile)}`));
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.split('\n');
          const lastLines = lines.slice(-50); // Show last 50 lines
          console.log(lastLines.join('\n'));
          console.log(timmy.divider());
          foundLogs = true;
        }
      }

      if (!foundLogs) {
        console.log(timmy.info(`No logs found for task ${taskId}`));
        console.log(timmy.dim(`Looking in: ${logsDir}`));
      }
      break;
    }

    case 'worktree clean': {
      if (!config.github.repoPath) {
        console.log(timmy.error('Repository path not configured'));
        break;
      }

      console.log(timmy.processing('Removing all Timmy worktrees...'));

      import('@/core/workspace/worktree-manager.service').then(async ({ getWorktreeManager }) => {
        try {
          const worktreeManager = getWorktreeManager(config.github.repoPath!);
          await worktreeManager.cleanupStaleWorktrees(config.github.repoPath!, 0); // 0 hours = remove all
          console.log(timmy.success('✓ All worktrees removed'));
        } catch (error) {
          console.log(timmy.error(`Failed to clean worktrees: ${(error as Error).message}`));
        }
      }).catch((error: Error) => {
        console.log(timmy.error(`Failed to load worktree manager: ${error.message}`));
      });
      break;
    }

    case '':
      // Empty command, do nothing
      break;

    default:
      console.log(timmy.error(`Unknown command: "${cmd}". Type "help" for available commands.`));
  }
}

// ============================================
// INTERACTIVE MODE SETUP
// ============================================

export function setupInteractiveMode(
  appState: AppState,
  pollCallback: () => Promise<void>,
  pollIntervalMs: number,
  shutdownCallback: () => void
): readline.Interface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.dim}${colors.magenta}timmy${colors.reset}${colors.dim}>${colors.reset} `
  });

  rl.on('line', (line: string) => {
    handleCommand(line, appState, pollCallback, pollIntervalMs, shutdownCallback);
    if (appState.isRunning) {
      rl.prompt();
    }
  });

  rl.on('close', () => {
    if (appState.isRunning) {
      shutdownCallback();
    }
  });

  return rl;
}
