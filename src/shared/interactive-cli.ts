import readline from 'readline';
import { timmy, colors } from './ui';
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
      console.log('\n' + timmy.section('📖 Available Commands'));
      console.log(`  ${timmy.label('help, h', 'Show this help message')}`);
      console.log(`  ${timmy.label('status, s', 'Show current status')}`);
      console.log(`  ${timmy.label('stop', 'Stop polling (keeps app running)')}`);
      console.log(`  ${timmy.label('start', 'Resume polling')}`);
      console.log(`  ${timmy.label('quit, q, exit', 'Exit application')}`);
      console.log(`  ${timmy.label('clear, cls', 'Clear terminal screen')}`);
      console.log(`  ${timmy.label('cache', 'Show cached tasks')}`);
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
        cachedTasks.forEach((task: storage.ProcessedTask) => {
          console.log(`  ${colors.cyan}${task.id}${colors.reset}`);
        });
      }
      console.log(timmy.divider() + '\n');
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
