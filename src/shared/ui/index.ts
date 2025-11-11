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
};

interface Forky {
  header: (text: string) => string;
  box: (text: string) => string;
  success: (text: string) => string;
  error: (text: string) => string;
  warning: (text: string) => string;
  info: (text: string) => string;
  processing: (text: string) => string;
  ai: (text: string) => string;
  step: (num: number, text: string) => string;
  divider: () => string;
  label: (key: string, value: string) => string;
  timestamp: () => string;
}

const forky: Forky = {
  header: (text: string): string => `${colors.bright}${colors.cyan}╔${'═'.repeat(text.length + 2)}╗\n║ ${text} ║\n╚${'═'.repeat(text.length + 2)}╝${colors.reset}`,
  box: (text: string): string => `${colors.cyan}┌${'─'.repeat(text.length + 2)}┐\n│ ${text} │\n└${'─'.repeat(text.length + 2)}┘${colors.reset}`,
  success: (text: string): string => `${colors.bright}${colors.green}✓${colors.reset} ${colors.green}${text}${colors.reset}`,
  error: (text: string): string => `${colors.bright}${colors.red}✗${colors.reset} ${colors.red}${text}${colors.reset}`,
  warning: (text: string): string => `${colors.bright}${colors.yellow}⚠${colors.reset} ${colors.yellow}${text}${colors.reset}`,
  info: (text: string): string => `${colors.cyan}ℹ${colors.reset} ${colors.white}${text}${colors.reset}`,
  processing: (text: string): string => `${colors.bright}${colors.blue}⚡${colors.reset} ${colors.blue}${text}${colors.reset}`,
  ai: (text: string): string => `${colors.bright}${colors.magenta}🍴 FORKY${colors.reset} ${colors.gray}»${colors.reset} ${colors.white}${text}${colors.reset}`,
  step: (num: number, text: string): string => `${colors.bright}${colors.cyan}[${num}]${colors.reset} ${colors.white}${text}${colors.reset}`,
  divider: (): string => `${colors.dim}${colors.gray}${'─'.repeat(70)}${colors.reset}`,
  label: (key: string, value: string): string => `${colors.dim}${key}:${colors.reset} ${colors.bright}${colors.white}${value}${colors.reset}`,
  timestamp: (): string => {
    const now = new Date();
    return `${colors.gray}[${now.toLocaleTimeString()}]${colors.reset}`;
  }
};

export { colors, forky, Colors, Forky };
