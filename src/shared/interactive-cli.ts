import readline from 'readline';
import { forky, colors } from './ui';
import * as storage from '../../lib/storage';

// ============================================
// INTERFACES
// ============================================

export interface AppState {
  isRunning: boolean;
  pollInterval: NodeJS.Timeout | null;
  isProcessing: boolean;
  currentTask: string | null;
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
      console.log('\n' + forky.section('📖 Available Commands'));
      console.log(`  ${forky.label('help, h', 'Show this help message')}`);
      console.log(`  ${forky.label('status, s', 'Show current status')}`);
      console.log(`  ${forky.label('stop', 'Stop polling (keeps app running)')}`);
      console.log(`  ${forky.label('start', 'Resume polling')}`);
      console.log(`  ${forky.label('quit, q, exit', 'Exit application')}`);
      console.log(`  ${forky.label('clear, cls', 'Clear terminal screen')}`);
      console.log(`  ${forky.label('cache', 'Show cached tasks')}`);
      console.log(forky.divider() + '\n');
      break;

    case 'status':
    case 's':
      console.log('\n' + forky.section('📊 System Status'));
      console.log(`  ${forky.label('Polling', appState.isRunning ? forky.badge('ACTIVE', 'green') : forky.badge('STOPPED', 'red'))}`);
      console.log(`  ${forky.label('Processing', appState.isProcessing ? forky.badge('YES', 'yellow') : forky.badge('NO', 'cyan'))}`);
      if (appState.currentTask) {
        console.log(`  ${forky.label('Current Task', appState.currentTask)}`);
      }
      console.log(`  ${forky.label('Cached Tasks', storage.cache.getIds().size.toString())}`);
      console.log(forky.divider() + '\n');
      break;

    case 'stop':
      if (!appState.isRunning) {
        console.log(forky.warning('Polling is already stopped'));
      } else {
        appState.isRunning = false;
        if (appState.pollInterval) {
          clearInterval(appState.pollInterval);
          appState.pollInterval = null;
        }
        console.log(forky.success('Polling stopped. Type "start" to resume.'));
      }
      break;

    case 'start':
      if (appState.isRunning && appState.pollInterval) {
        console.log(forky.warning('Polling is already running'));
      } else {
        appState.isRunning = true;
        appState.pollInterval = setInterval(pollCallback, pollIntervalMs);
        console.log(forky.success('Polling resumed'));
        pollCallback(); // Run immediately
      }
      break;

    case 'quit':
    case 'q':
    case 'exit':
      if (appState.isProcessing) {
        console.log(forky.warning(`Task ${appState.currentTask} is still processing. Are you sure?`));
        console.log(forky.info('Type "quit" again to force exit, or wait for task to complete.'));
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
      console.log(forky.banner());
      console.log(forky.info('Terminal cleared\n'));
      break;

    case 'cache': {
      console.log('\n' + forky.section('📦 Cached Tasks'));
      const cachedTasks = storage.cache.getData();
      if (cachedTasks.length === 0) {
        console.log(forky.info('No cached tasks'));
      } else {
        cachedTasks.forEach((task: storage.ProcessedTask) => {
          console.log(`  ${colors.cyan}${task.id}${colors.reset}`);
        });
      }
      console.log(forky.divider() + '\n');
      break;
    }

    case '':
      // Empty command, do nothing
      break;

    default:
      console.log(forky.error(`Unknown command: "${cmd}". Type "help" for available commands.`));
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
    prompt: `${colors.dim}${colors.gray}forky>${colors.reset} `
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
