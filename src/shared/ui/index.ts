interface Colors {
  reset: string;
  bright: string;
  dim: string;
  cyan: string;
  blue: string;
  green: string;
  yellow: string;
  red: string;
  magenta: string;
  white: string;
  gray: string;
  bgBlue: string;
  bgGreen: string;
  bgYellow: string;
  bgRed: string;
  bgCyan: string;
  bgMagenta: string;
  bgBlack: string;
}

const colors: Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  bgCyan: '\x1b[46m',
  bgMagenta: '\x1b[45m',
  bgBlack: '\x1b[40m',
};

interface Timmy {
  header: (text: string) => string;
  banner: () => string;
  box: (text: string) => string;
  success: (text: string) => string;
  error: (text: string) => string;
  warning: (text: string) => string;
  info: (text: string) => string;
  processing: (text: string) => string;
  ai: (text: string) => string;
  step: (num: number, text: string) => string;
  divider: () => string;
  doubleDivider: () => string;
  label: (key: string, value: string) => string;
  timestamp: () => string;
  spinner: {
    start: (text: string) => SpinnerInstance;
  };
  progressBar: (current: number, total: number, width?: number) => string;
  badge: (text: string, color: 'green' | 'blue' | 'yellow' | 'red' | 'magenta' | 'cyan') => string;
  section: (title: string) => string;
}

interface SpinnerInstance {
  update: (text: string) => void;
  succeed: (text?: string) => void;
  fail: (text?: string) => void;
  stop: () => void;
}

// Spinner frames for animation
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const timmy: Timmy = {
  header: (text: string): string => `${colors.bright}${colors.cyan}╔${'═'.repeat(text.length + 2)}╗\n║ ${text} ║\n╚${'═'.repeat(text.length + 2)}╝${colors.reset}`,

  banner: (): string => {
    const banner = `
${colors.bright}${colors.magenta}
    ████████╗██╗███╗   ███╗███╗   ███╗██╗   ██╗
    ╚══██╔══╝██║████╗ ████║████╗ ████║╚██╗ ██╔╝
       ██║   ██║██╔████╔██║██╔████╔██║ ╚████╔╝
       ██║   ██║██║╚██╔╝██║██║╚██╔╝██║  ╚██╔╝
       ██║   ██║██║ ╚═╝ ██║██║ ╚═╝ ██║   ██║
       ╚═╝   ╚═╝╚═╝     ╚═╝╚═╝     ╚═╝   ╚═╝
${colors.reset}${colors.cyan}
    🤖 Autonomous Task Automation System ${colors.reset}
${colors.dim}${colors.gray}    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`;
    return banner;
  },

  box: (text: string): string => `${colors.cyan}┌${'─'.repeat(text.length + 2)}┐\n│ ${text} │\n└${'─'.repeat(text.length + 2)}┘${colors.reset}`,

  success: (text: string): string => `${colors.bright}${colors.green}✓${colors.reset} ${colors.green}${text}${colors.reset}`,

  error: (text: string): string => `${colors.bright}${colors.red}✗${colors.reset} ${colors.red}${text}${colors.reset}`,

  warning: (text: string): string => `${colors.bright}${colors.yellow}⚠${colors.reset} ${colors.yellow}${text}${colors.reset}`,

  info: (text: string): string => `${colors.cyan}ℹ${colors.reset} ${colors.white}${text}${colors.reset}`,

  processing: (text: string): string => `${colors.bright}${colors.blue}⚡${colors.reset} ${colors.blue}${text}${colors.reset}`,

  ai: (text: string): string => `${colors.bright}${colors.magenta}🤖 TIMMY${colors.reset} ${colors.gray}»${colors.reset} ${colors.white}${text}${colors.reset}`,

  step: (num: number, text: string): string => `${colors.bright}${colors.cyan}[${num}]${colors.reset} ${colors.white}${text}${colors.reset}`,

  divider: (): string => `${colors.dim}${colors.gray}${'─'.repeat(70)}${colors.reset}`,

  doubleDivider: (): string => `${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}`,

  label: (key: string, value: string): string => `${colors.dim}${key}:${colors.reset} ${colors.bright}${colors.white}${value}${colors.reset}`,

  timestamp: (): string => {
    const now = new Date();
    return `${colors.gray}[${now.toLocaleTimeString()}]${colors.reset}`;
  },

  spinner: {
    start: (text: string): SpinnerInstance => {
      let frameIndex = 0;
      let currentText = text;
      let intervalId: NodeJS.Timeout | null = null;
      let isActive = true;

      const render = (): void => {
        if (!isActive) return;
        process.stdout.write('\r\x1b[K'); // Clear line
        const frame = spinnerFrames[frameIndex];
        process.stdout.write(`${colors.bright}${colors.cyan}${frame}${colors.reset} ${colors.white}${currentText}${colors.reset}`);
        frameIndex = (frameIndex + 1) % spinnerFrames.length;
      };

      intervalId = setInterval(render, 80);
      render();

      return {
        update: (newText: string): void => {
          currentText = newText;
        },
        succeed: (finalText?: string): void => {
          if (intervalId) clearInterval(intervalId);
          isActive = false;
          process.stdout.write('\r\x1b[K');
          console.log(timmy.success(finalText || currentText));
        },
        fail: (finalText?: string): void => {
          if (intervalId) clearInterval(intervalId);
          isActive = false;
          process.stdout.write('\r\x1b[K');
          console.log(timmy.error(finalText || currentText));
        },
        stop: (): void => {
          if (intervalId) clearInterval(intervalId);
          isActive = false;
          process.stdout.write('\r\x1b[K');
        }
      };
    }
  },

  progressBar: (current: number, total: number, width: number = 40): string => {
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filled = Math.round((width * percentage) / 100);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentStr = percentage.toFixed(0).padStart(3, ' ');

    return `${colors.cyan}[${colors.bright}${colors.green}${bar}${colors.reset}${colors.cyan}]${colors.reset} ${colors.bright}${percentStr}%${colors.reset} ${colors.dim}(${current}/${total})${colors.reset}`;
  },

  badge: (text: string, color: 'green' | 'blue' | 'yellow' | 'red' | 'magenta' | 'cyan'): string => {
    const colorCode = colors[color];
    return `${colors.bright}${colorCode} ${text} ${colors.reset}`;
  },

  section: (title: string): string => {
    return `\n${colors.bright}${colors.cyan}▌${colors.reset} ${colors.bright}${colors.white}${title}${colors.reset}\n${colors.dim}${colors.gray}${'─'.repeat(70)}${colors.reset}`;
  }
};

export { colors, timmy, Colors, Timmy, SpinnerInstance };
