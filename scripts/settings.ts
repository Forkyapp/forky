#!/usr/bin/env ts-node

/**
 * Settings Manager for Forky
 * Allows users to modify configuration after initial setup
 */

import * as readline from 'readline';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

interface EnvConfig {
  [key: string]: string;
}

class SettingsManager {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  private parseEnv(): EnvConfig {
    if (!fs.existsSync('.env')) {
      return {};
    }

    const content = fs.readFileSync('.env', 'utf8');
    const config: EnvConfig = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        config[match[1]] = match[2];
      }
    }

    return config;
  }

  private async getGitHubAuthStatus(): Promise<{ authenticated: boolean; username?: string }> {
    try {
      const { stdout } = await execAsync('gh auth status 2>&1');
      const authenticated = stdout.includes('Logged in');

      if (authenticated) {
        const usernameMatch = stdout.match(/Logged in to github\.com account ([^\s]+)/);
        const username = usernameMatch ? usernameMatch[1] : undefined;
        return { authenticated, username };
      }

      return { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  }

  private async reauthenticateGitHub(): Promise<void> {
    this.log('\n🔐 Re-authenticating with GitHub...', 'cyan');

    const method = await this.question(
      'Choose authentication method:\n' +
      '  1) Browser (recommended)\n' +
      '  2) Token\n' +
      'Choice (1-2): '
    );

    try {
      if (method === '1' || !method) {
        await execAsync('gh auth login -w');
      } else {
        const token = await this.question('Enter your GitHub token: ');
        await execAsync(`echo "${token}" | gh auth login --with-token`);
      }

      const status = await this.getGitHubAuthStatus();
      if (status.authenticated && status.username) {
        this.log(`✅ Successfully authenticated as ${status.username}`, 'green');

        // Update token in .env
        const { stdout } = await execAsync('gh auth token');
        const token = stdout.trim();
        await this.updateEnvValue('GITHUB_TOKEN', token);
        await this.updateEnvValue('GITHUB_DEFAULT_USERNAME', status.username);
      }
    } catch (error) {
      this.log(`❌ Authentication failed: ${(error as Error).message}`, 'red');
    }
  }

  private async updateEnvValue(key: string, value: string): Promise<void> {
    const envPath = '.env';
    let content = fs.readFileSync(envPath, 'utf8');

    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, content);
  }

  private async showMainMenu(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                    Forky Settings                         ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

    const env = this.parseEnv();
    const authStatus = await this.getGitHubAuthStatus();

    this.log('Current Configuration:', 'bright');
    this.log('─'.repeat(60), 'cyan');
    this.log(`GitHub User:        ${authStatus.username || 'Not authenticated'}`, authStatus.authenticated ? 'green' : 'red');
    this.log(`ClickUp User ID:    ${env.CLICKUP_BOT_USER_ID || 'Not set'}`, env.CLICKUP_BOT_USER_ID ? 'green' : 'yellow');
    this.log(`ClickUp Workspace:  ${this.getCurrentWorkspace()}`, 'cyan');
    this.log(`Poll Interval:      ${env.POLL_INTERVAL_MS ? parseInt(env.POLL_INTERVAL_MS) / 1000 + 's' : 'Not set'}`, 'cyan');
    this.log(`Comments Disabled:  ${env.DISABLE_COMMENTS || 'false'}`, 'cyan');
    this.log('─'.repeat(60) + '\n', 'cyan');

    this.log('What would you like to do?\n', 'bright');
    this.log('  1) Change GitHub account', 'cyan');
    this.log('  2) Update ClickUp credentials', 'cyan');
    this.log('  3) Manage projects', 'cyan');
    this.log('  4) System settings', 'cyan');
    this.log('  5) View all settings', 'cyan');
    this.log('  6) Exit\n', 'cyan');

    const choice = await this.question('Choose an option (1-6): ');

    switch (choice) {
      case '1':
        await this.changeGitHubAccount();
        break;
      case '2':
        await this.updateClickUpCredentials();
        break;
      case '3':
        await this.manageProjects();
        break;
      case '4':
        await this.systemSettings();
        break;
      case '5':
        await this.viewAllSettings();
        break;
      case '6':
        this.log('\n👋 Goodbye!\n', 'cyan');
        this.rl.close();
        return;
      default:
        this.log('\n❌ Invalid choice. Please try again.\n', 'red');
        await this.question('Press Enter to continue...');
        await this.showMainMenu();
    }
  }

  private getCurrentWorkspace(): string {
    try {
      if (!fs.existsSync('workspace.json')) return 'Not configured';
      const workspace = JSON.parse(fs.readFileSync('workspace.json', 'utf8'));
      return workspace.activeProject || 'Not set';
    } catch {
      return 'Error reading workspace';
    }
  }

  private async changeGitHubAccount(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                  Change GitHub Account                    ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

    const status = await this.getGitHubAuthStatus();
    if (status.authenticated && status.username) {
      this.log(`Currently authenticated as: ${colors.bright}${status.username}${colors.reset}\n`, 'green');
    }

    this.log('Options:\n', 'bright');
    this.log('  1) Re-authenticate with GitHub', 'cyan');
    this.log('  2) Manually update token', 'cyan');
    this.log('  3) Back to main menu\n', 'cyan');

    const choice = await this.question('Choose an option (1-3): ');

    switch (choice) {
      case '1':
        await this.reauthenticateGitHub();
        break;
      case '2': {
        const token = await this.question('\nEnter new GitHub token: ');
        const username = await this.question('Enter GitHub username: ');
        await this.updateEnvValue('GITHUB_TOKEN', token);
        await this.updateEnvValue('GITHUB_DEFAULT_USERNAME', username);
        this.log('✅ GitHub credentials updated', 'green');
        break;
      }
      case '3':
        await this.showMainMenu();
        return;
    }

    await this.question('\nPress Enter to return to main menu...');
    await this.showMainMenu();
  }

  private async updateClickUpCredentials(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                Update ClickUp Credentials                 ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

    const env = this.parseEnv();

    this.log('Current values:', 'bright');
    this.log(`  API Key: ${env.CLICKUP_API_KEY ? '***' + env.CLICKUP_API_KEY.slice(-8) : 'Not set'}`, 'cyan');
    this.log(`  Bot User ID: ${env.CLICKUP_BOT_USER_ID || 'Not set'}`, 'cyan');
    this.log(`  Secret: ${env.CLICKUP_SECRET ? '***' : 'Not set'}\n`, 'cyan');

    const updateKey = await this.question('Update API Key? (leave blank to skip): ');
    if (updateKey) {
      await this.updateEnvValue('CLICKUP_API_KEY', updateKey);
      this.log('✅ API Key updated', 'green');
    }

    const updateUserId = await this.question('Update Bot User ID? (leave blank to skip): ');
    if (updateUserId) {
      await this.updateEnvValue('CLICKUP_BOT_USER_ID', updateUserId);
      this.log('✅ Bot User ID updated', 'green');
    }

    const updateSecret = await this.question('Update Secret? (leave blank to skip): ');
    if (updateSecret) {
      await this.updateEnvValue('CLICKUP_SECRET', updateSecret);
      this.log('✅ Secret updated', 'green');
    }

    await this.question('\nPress Enter to return to main menu...');
    await this.showMainMenu();
  }

  private async manageProjects(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                    Manage Projects                        ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

    this.log('Use these commands:\n', 'bright');
    this.log('  npm run projects  - List all projects', 'cyan');
    this.log('  npm run switch    - Switch active project', 'cyan');
    this.log('  npm run current   - Show current project\n', 'cyan');

    this.log('To edit projects.json directly:\n', 'bright');
    this.log('  vim projects.json', 'cyan');
    this.log('  code projects.json\n', 'cyan');

    await this.question('Press Enter to return to main menu...');
    await this.showMainMenu();
  }

  private async systemSettings(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                    System Settings                        ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

    const env = this.parseEnv();

    this.log('Current settings:', 'bright');
    this.log(`  Poll Interval: ${env.POLL_INTERVAL_MS ? parseInt(env.POLL_INTERVAL_MS) / 1000 + 's' : 'Not set'}`, 'cyan');
    this.log(`  Comments Disabled: ${env.DISABLE_COMMENTS || 'false'}`, 'cyan');
    this.log(`  Auto-Create Repo: ${env.AUTO_CREATE_REPO || 'false'}\n`, 'cyan');

    const updatePoll = await this.question('New poll interval in seconds (blank to skip): ');
    if (updatePoll) {
      await this.updateEnvValue('POLL_INTERVAL_MS', (parseInt(updatePoll) * 1000).toString());
      this.log('✅ Poll interval updated', 'green');
    }

    const disableComments = await this.question('Disable comments? (y/n, blank to skip): ');
    if (disableComments) {
      await this.updateEnvValue('DISABLE_COMMENTS', disableComments.toLowerCase() === 'y' ? 'true' : 'false');
      this.log('✅ Comment setting updated', 'green');
    }

    const autoCreate = await this.question('Auto-create repos? (y/n, blank to skip): ');
    if (autoCreate) {
      await this.updateEnvValue('AUTO_CREATE_REPO', autoCreate.toLowerCase() === 'y' ? 'true' : 'false');
      this.log('✅ Auto-create setting updated', 'green');
    }

    await this.question('\nPress Enter to return to main menu...');
    await this.showMainMenu();
  }

  private async viewAllSettings(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                    All Settings                           ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

    const env = this.parseEnv();

    this.log('.env configuration:', 'bright');
    this.log('─'.repeat(60), 'cyan');

    for (const [key, value] of Object.entries(env)) {
      // Hide sensitive values
      let displayValue = value;
      if (key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')) {
        displayValue = value ? '***' + value.slice(-8) : 'Not set';
      }
      this.log(`${key.padEnd(30)} = ${displayValue}`, 'cyan');
    }

    this.log('─'.repeat(60) + '\n', 'cyan');

    await this.question('Press Enter to return to main menu...');
    await this.showMainMenu();
  }

  async run(): Promise<void> {
    try {
      if (!fs.existsSync('.env')) {
        this.log('❌ No configuration found!', 'red');
        this.log('Please run the interactive setup first:', 'yellow');
        this.log('  npm run init\n', 'cyan');
        this.rl.close();
        return;
      }

      await this.showMainMenu();
    } catch (error) {
      this.log(`\n❌ Error: ${(error as Error).message}`, 'red');
    } finally {
      this.rl.close();
    }
  }
}

// Run settings manager
const settings = new SettingsManager();
settings.run().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
