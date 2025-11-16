#!/usr/bin/env ts-node

/**
 * Interactive First-Time Setup for Forky
 * Similar to Claude Code's onboarding experience
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
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

interface SetupConfig {
  // ClickUp
  clickupApiKey: string;
  clickupSecret: string;
  clickupBotUserId: string;
  clickupWorkspaceId: string;
  clickupListId: string;

  // GitHub
  githubToken: string;
  githubUsername: string;
  useGitHubAuth: boolean;

  // OpenAI (optional)
  openaiApiKey: string;

  // Discord (optional)
  discordEnabled: boolean;
  discordBotToken: string;
  discordGuildId: string;
  discordChannelIds: string;

  // Project
  projectName: string;
  projectDescription: string;
  repoOwner: string;
  repoName: string;
  repoPath: string;
  baseBranch: string;

  // System
  pollInterval: number;
  disableComments: boolean;
  autoCreateRepo: boolean;
}

class InteractiveSetup {
  private rl: readline.Interface;
  private config: Partial<SetupConfig> = {};

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

  private async confirm(prompt: string, defaultValue = true): Promise<boolean> {
    const defaultStr = defaultValue ? 'Y/n' : 'y/N';
    const answer = await this.question(`${prompt} (${defaultStr}): `);

    if (!answer) return defaultValue;
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  private log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  private async checkGitHubCLI(): Promise<boolean> {
    try {
      await execAsync('gh --version');
      return true;
    } catch {
      return false;
    }
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

  private async authenticateGitHub(): Promise<string | null> {
    this.log('\n🔐 GitHub Authentication', 'cyan');
    this.log('We need access to GitHub to create PRs and manage repositories.\n');

    const hasGH = await this.checkGitHubCLI();

    if (!hasGH) {
      this.log('❌ GitHub CLI (gh) not found!', 'red');
      this.log('Please install it first: https://cli.github.com/\n', 'yellow');
      return null;
    }

    const authStatus = await this.getGitHubAuthStatus();

    if (authStatus.authenticated && authStatus.username) {
      this.log(`✅ Already authenticated as ${colors.bright}${authStatus.username}${colors.reset}`, 'green');
      const useExisting = await this.confirm('Use this GitHub account?', true);

      if (useExisting) {
        return authStatus.username;
      }
    }

    this.log('\nStarting GitHub authentication...\n', 'cyan');
    const authMethod = await this.question(
      'Choose authentication method:\n' +
      '  1) Browser (recommended)\n' +
      '  2) Token\n' +
      'Choice (1-2): '
    );

    try {
      if (authMethod === '1' || !authMethod) {
        this.log('\nOpening browser for authentication...', 'cyan');
        await execAsync('gh auth login -w');
      } else {
        this.log('\nYou can create a token at: https://github.com/settings/tokens', 'cyan');
        const token = await this.question('Enter your GitHub token: ');
        await execAsync(`echo "${token}" | gh auth login --with-token`);
      }

      const newStatus = await this.getGitHubAuthStatus();
      if (newStatus.authenticated && newStatus.username) {
        this.log(`\n✅ Successfully authenticated as ${colors.bright}${newStatus.username}${colors.reset}`, 'green');
        return newStatus.username;
      }
    } catch (error) {
      this.log(`\n❌ Authentication failed: ${(error as Error).message}`, 'red');
    }

    return null;
  }

  private async getGitHubToken(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('gh auth token');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  private async validateClickUpApiKey(apiKey: string): Promise<{ valid: boolean; user?: { id: string; username: string } }> {
    try {
      const response = await execAsync(`curl -s -H "Authorization: ${apiKey}" https://api.clickup.com/api/v2/user`);
      const data = JSON.parse(response.stdout);

      if (data.user) {
        return {
          valid: true,
          user: {
            id: data.user.id.toString(),
            username: data.user.username,
          },
        };
      }
      return { valid: false };
    } catch {
      return { valid: false };
    }
  }

  private async getClickUpWorkspaces(apiKey: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await execAsync(`curl -s -H "Authorization: ${apiKey}" https://api.clickup.com/api/v2/team`);
      const data = JSON.parse(response.stdout);

      if (data.teams) {
        return data.teams.map((team: { id: string; name: string }) => ({
          id: team.id,
          name: team.name,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  private async configureOptionalServices(): Promise<void> {
    // OpenAI API
    this.log('\n📝 OpenAI API Key (for RAG-based context loading):', 'cyan');
    this.log('  Get your key at: https://platform.openai.com/api-keys', 'dim');
    this.log('  (Press Enter to skip)\n', 'dim');

    const openaiKey = await this.question('OpenAI API Key: ');
    this.config.openaiApiKey = openaiKey || '';

    if (openaiKey) {
      this.log('✓ OpenAI API configured', 'green');
    } else {
      this.log('Skipped OpenAI API (you can add it later in .env)', 'dim');
    }

    // Discord Bot
    this.log('\n📝 Discord Bot (for monitoring Discord channels):', 'cyan');
    this.log('  Get started at: https://discord.com/developers/applications', 'dim');
    this.log('  (Press Enter to skip)\n', 'dim');

    const discordToken = await this.question('Discord Bot Token: ');

    if (discordToken) {
      this.config.discordEnabled = true;
      this.config.discordBotToken = discordToken;
      this.config.discordGuildId = await this.question('Discord Guild (Server) ID: ');
      this.log('Enter channel IDs to monitor (comma-separated):', 'cyan');
      this.config.discordChannelIds = await this.question('Channel IDs: ');
      this.log('✓ Discord Bot configured', 'green');
    } else {
      this.config.discordEnabled = false;
      this.config.discordBotToken = '';
      this.config.discordGuildId = '';
      this.config.discordChannelIds = '';
      this.log('Skipped Discord Bot (you can add it later in .env)', 'dim');
    }
  }

  private async configureClickUp(): Promise<void> {
    this.log('Let\'s connect to ClickUp!\n', 'bright');

    // Guide to get API key
    this.log('📝 Getting your ClickUp API Key:', 'cyan');
    this.log('  1. Go to: https://app.clickup.com/settings/apps', 'cyan');
    this.log('  2. Click "Apps" in the sidebar', 'cyan');
    this.log('  3. Click "Generate" under "API Token"', 'cyan');
    this.log('  4. Copy the token\n', 'cyan');

    const openSettings = await this.confirm('Open ClickUp settings in browser?', true);
    if (openSettings) {
      try {
        await execAsync('open https://app.clickup.com/settings/apps');
        this.log('✅ Opened ClickUp settings in browser\n', 'green');
      } catch {
        // Ignore error if browser doesn't open
      }
    }

    // Get and validate API key
    let apiKeyValid = false;
    let userId: string | undefined;

    while (!apiKeyValid) {
      const apiKey = await this.question('Enter your ClickUp API Key: ');

      if (!apiKey) {
        this.log('❌ API key is required', 'red');
        continue;
      }

      this.log('Validating API key...', 'cyan');
      const validation = await this.validateClickUpApiKey(apiKey);

      if (validation.valid && validation.user) {
        this.log(`✅ API key valid! Authenticated as: ${colors.bright}${validation.user.username}${colors.reset}`, 'green');
        this.config.clickupApiKey = apiKey;
        userId = validation.user.id;
        apiKeyValid = true;
      } else {
        this.log('❌ Invalid API key. Please check and try again.', 'red');
        const retry = await this.confirm('Try again?', true);
        if (!retry) {
          throw new Error('ClickUp API key is required');
        }
      }
    }

    // Bot user ID (auto-filled from validation)
    this.config.clickupBotUserId = userId!;
    this.log(`\n✓ Bot User ID: ${userId}`, 'green');

    // OAuth secret (skip for most users - can be added later in .env if needed)
    this.config.clickupSecret = '';

    // Auto-detect workspaces
    this.log('\n🔍 Detecting your ClickUp workspaces...', 'cyan');
    const workspaces = await this.getClickUpWorkspaces(this.config.clickupApiKey!);

    if (workspaces.length === 0) {
      this.log('⚠️  Could not auto-detect workspaces', 'yellow');
      this.log('Find your workspace ID in the ClickUp URL:', 'cyan');
      this.log('  https://app.clickup.com/WORKSPACE_ID/...', 'cyan');
      this.config.clickupWorkspaceId = await this.question('\nWorkspace ID: ');
    } else if (workspaces.length === 1) {
      this.log(`✅ Found workspace: ${colors.bright}${workspaces[0].name}${colors.reset}`, 'green');
      this.config.clickupWorkspaceId = workspaces[0].id;
    } else {
      this.log(`\n✅ Found ${workspaces.length} workspaces:\n`, 'green');
      workspaces.forEach((ws, idx) => {
        this.log(`  ${idx + 1}) ${ws.name} (ID: ${ws.id})`, 'cyan');
      });

      const choice = await this.question(`\nSelect workspace (1-${workspaces.length}): `);
      const selectedIdx = parseInt(choice) - 1;

      if (selectedIdx >= 0 && selectedIdx < workspaces.length) {
        this.config.clickupWorkspaceId = workspaces[selectedIdx].id;
        this.log(`✓ Selected: ${workspaces[selectedIdx].name}`, 'green');
      } else {
        this.log('Invalid selection. Please enter workspace ID manually.', 'yellow');
        this.config.clickupWorkspaceId = await this.question('Workspace ID: ');
      }
    }

    // Optional: ClickUp List ID for Discord integration
    this.log('\n📝 ClickUp List ID (optional - for Discord bot integration):', 'cyan');
    this.log('  This is where Discord-reported bugs will be created as tasks.', 'dim');
    this.log('  Find it in the URL when viewing a List:', 'dim');
    this.log('  https://app.clickup.com/12345678/v/li/901234567', 'dim');
    this.log('                                       ↑ This is your List ID', 'dim');
    this.log('  (Press Enter to skip - you can add it later in .env)\n', 'dim');

    const listId = await this.question('ClickUp List ID (optional): ');
    this.config.clickupListId = listId || '';

    if (listId) {
      this.log(`✓ List ID configured: ${listId}`, 'green');
    } else {
      this.log('Skipped List ID (Discord task creation will be disabled)', 'dim');
    }
  }

  private showConfigurationSummary(): void {
    this.log('\n' + '='.repeat(60), 'cyan');
    this.log('📋 Configuration Summary', 'bright');
    this.log('='.repeat(60) + '\n', 'cyan');

    this.log(`${colors.bright}GitHub${colors.reset}`);
    this.log(`  Username: ${colors.cyan}${this.config.githubUsername}${colors.reset}`);
    this.log(`  Token: ${colors.dim}${this.config.githubToken?.substring(0, 10)}...${colors.reset}`);

    this.log(`\n${colors.bright}ClickUp${colors.reset}`);
    this.log(`  Workspace ID: ${colors.cyan}${this.config.clickupWorkspaceId}${colors.reset}`);
    this.log(`  Bot User ID: ${colors.cyan}${this.config.clickupBotUserId}${colors.reset}`);
    this.log(`  List ID: ${this.config.clickupListId ? colors.cyan + this.config.clickupListId : colors.dim + 'Not configured'}${colors.reset}`);

    this.log(`\n${colors.bright}Project${colors.reset}`);
    this.log(`  Name: ${colors.cyan}${this.config.projectName}${colors.reset}`);
    this.log(`  Description: ${colors.dim}${this.config.projectDescription}${colors.reset}`);
    this.log(`  Repository: ${colors.cyan}${this.config.repoOwner}/${this.config.repoName}${colors.reset}`);
    this.log(`  Path: ${colors.dim}${this.config.repoPath}${colors.reset}`);
    this.log(`  Base Branch: ${colors.cyan}${this.config.baseBranch}${colors.reset}`);

    this.log(`\n${colors.bright}System${colors.reset}`);
    this.log(`  Poll Interval: ${colors.cyan}${(this.config.pollInterval || 15000) / 1000}s${colors.reset}`);
    this.log(`  Disable Comments: ${this.config.disableComments ? colors.red + 'Yes' : colors.green + 'No'}${colors.reset}`);
    this.log(`  Auto-create Repos: ${this.config.autoCreateRepo ? colors.green + 'Yes' : colors.dim + 'No'}${colors.reset}`);

    this.log(`\n${colors.bright}Optional Services${colors.reset}`);
    this.log(`  OpenAI API: ${this.config.openaiApiKey ? colors.green + 'Configured' : colors.dim + 'Not configured'}${colors.reset}`);
    this.log(`  Discord Bot: ${this.config.discordEnabled ? colors.green + 'Enabled' : colors.dim + 'Disabled'}${colors.reset}`);

    this.log('\n' + '='.repeat(60), 'cyan');
  }

  async run(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                                                           ║', 'cyan');
    this.log('║                  🤖 Welcome to Timmy!                    ║', 'cyan');
    this.log('║                                                           ║', 'cyan');
    this.log('║          Autonomous Task Automation System                ║', 'cyan');
    this.log('║                                                           ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
    this.log('\nLet\'s get you set up! This will only take a few minutes.\n');
    this.log('We need to configure:', 'bright');
    this.log('  • GitHub (for managing code)', 'cyan');
    this.log('  • ClickUp (for task management)', 'cyan');
    this.log('  • Your project details', 'cyan');
    this.log('  • Optional services (OpenAI, Discord)\n', 'dim');

    // Check if already configured
    if (fs.existsSync('.env') && fs.existsSync('workspace.json')) {
      const reconfigure = await this.confirm(
        'Configuration files already exist. Reconfigure?',
        false
      );
      if (!reconfigure) {
        this.log('\n👍 Using existing configuration.', 'green');
        this.log('To modify settings, run: npm run settings\n', 'cyan');
        this.rl.close();
        return;
      }
    }

    try {
      const totalSteps = 5;

      // Step 1: GitHub Authentication
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log(`Step 1/${totalSteps}: GitHub Configuration`, 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      const useGitHubAuth = await this.confirm(
        'Use GitHub CLI for automatic authentication?',
        true
      );

      let githubUsername: string;
      let githubToken: string;

      if (useGitHubAuth) {
        const username = await this.authenticateGitHub();
        if (!username) {
          this.log('\n❌ GitHub authentication required to continue.', 'red');
          this.rl.close();
          return;
        }
        githubUsername = username;

        const token = await this.getGitHubToken();
        if (!token) {
          this.log('\n❌ Failed to retrieve GitHub token.', 'red');
          this.rl.close();
          return;
        }
        githubToken = token;
        this.config.useGitHubAuth = true;
      } else {
        this.log('\nYou can create a token at: https://github.com/settings/tokens', 'cyan');
        this.log('Required scopes: repo, workflow, read:org\n', 'yellow');

        githubToken = await this.question('GitHub Personal Access Token: ');
        githubUsername = await this.question('GitHub Username: ');
        this.config.useGitHubAuth = false;
      }

      this.config.githubToken = githubToken;
      this.config.githubUsername = githubUsername;

      // Step 2: ClickUp Configuration
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log(`Step 2/${totalSteps}: ClickUp Configuration`, 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      await this.configureClickUp();

      // Step 3: Project Configuration
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log(`Step 3/${totalSteps}: Project Configuration`, 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      this.config.projectName = await this.question('Project name (e.g., "my-app"): ');
      this.config.projectDescription = await this.question('Project description: ');

      this.config.repoOwner = await this.question(`Repository owner (default: ${githubUsername}): `) || githubUsername;
      this.config.repoName = await this.question('Repository name: ');

      // Better path handling with validation
      this.log('\nEnter the full path where your repository is located:', 'cyan');
      this.log('(Leave empty to use current directory)', 'dim');

      let repoPath: string | undefined;
      let pathValid = false;

      while (!pathValid) {
        const inputPath = await this.question('Repository path: ');

        if (!inputPath) {
          // Use current directory
          repoPath = process.cwd();
          this.log(`Using current directory: ${repoPath}`, 'green');
          pathValid = true;
        } else {
          // Expand ~ to home directory
          const expandedPath = inputPath.replace(/^~/, process.env.HOME || '');

          if (fs.existsSync(expandedPath)) {
            repoPath = expandedPath;
            this.log(`✓ Path exists: ${repoPath}`, 'green');
            pathValid = true;
          } else {
            this.log(`⚠️  Path does not exist: ${expandedPath}`, 'yellow');
            const createIt = await this.confirm('Create this directory?', false);

            if (createIt) {
              try {
                fs.mkdirSync(expandedPath, { recursive: true });
                repoPath = expandedPath;
                this.log(`✓ Created directory: ${repoPath}`, 'green');
                pathValid = true;
              } catch (error) {
                this.log(`❌ Failed to create directory: ${(error as Error).message}`, 'red');
              }
            }
          }
        }
      }

      this.config.repoPath = repoPath!;
      this.config.baseBranch = await this.question('Base branch (default: main): ') || 'main';

      // Step 4: System Settings
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log(`Step 4/${totalSteps}: System Settings`, 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      const pollInterval = await this.question('Polling interval in seconds (default: 15): ');
      this.config.pollInterval = pollInterval ? parseInt(pollInterval) * 1000 : 15000;

      this.config.disableComments = await this.confirm('Disable all comments (ClickUp and GitHub)?', false);
      this.config.autoCreateRepo = await this.confirm('Auto-create GitHub repos when needed?', false);

      // Step 5: Optional Services Configuration
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log(`Step 5/${totalSteps}: Optional Services (Optional)`, 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      this.log('These services are optional but enhance Timmy:', 'cyan');
      this.log('  • OpenAI API - Better context loading (improves AI accuracy)', 'dim');
      this.log('  • Discord Bot - Monitor Discord channels for issues\n', 'dim');

      const configureOptional = await this.confirm('Configure these now? (you can skip and add later)', false);
      if (configureOptional) {
        await this.configureOptionalServices();
      } else {
        this.config.openaiApiKey = '';
        this.config.discordEnabled = false;
        this.config.discordBotToken = '';
        this.config.discordGuildId = '';
        this.config.discordChannelIds = '';
        this.log('\n✓ Skipped optional services (add them later in .env if needed)', 'dim');
      }

      // Show configuration summary before saving
      this.showConfigurationSummary();

      const confirmSave = await this.confirm('\nSave this configuration?', true);
      if (!confirmSave) {
        this.log('\n❌ Setup cancelled. No changes were saved.', 'yellow');
        this.rl.close();
        return;
      }

      // Save configuration
      await this.saveConfiguration();

      // Success message
      this.log('\n' + '='.repeat(60), 'green');
      this.log('✅ Setup Complete!', 'green');
      this.log('='.repeat(60) + '\n', 'green');

      this.log('Your configuration has been saved. Next steps:\n', 'bright');
      this.log('  1. Install dependencies: npm install', 'cyan');
      this.log('  2. Build the project: npm run build', 'cyan');
      this.log('  3. Start Timmy: npm start', 'cyan');
      this.log('\nUseful commands:', 'bright');
      this.log('  • Modify settings: npm run settings', 'dim');
      this.log('  • Switch projects: npm run switch <project-name>', 'dim');
      this.log('  • List projects: npm run projects\n', 'dim');

    } catch (error) {
      this.log(`\n❌ Setup failed: ${(error as Error).message}`, 'red');
    } finally {
      this.rl.close();
    }
  }

  private async saveConfiguration(): Promise<void> {
    this.log('\n💾 Saving configuration...', 'cyan');

    // Create .env file
    const envContent = `PORT=8080

# ============================================
# GLOBAL CREDENTIALS (Used for all projects)
# ============================================

# ClickUp API Credentials
CLICKUP_API_KEY=${this.config.clickupApiKey}
CLICKUP_SECRET=${this.config.clickupSecret || ''}
CLICKUP_BOT_USER_ID=${this.config.clickupBotUserId}
${this.config.clickupListId ? `CLICKUP_LIST_ID=${this.config.clickupListId}` : '# CLICKUP_LIST_ID=                             # List ID where Discord tasks will be created (optional)'}

# GitHub Token (single token works for all repos you have access to)
GITHUB_TOKEN=${this.config.githubToken}

# OpenAI API Key (Optional - for RAG/embeddings context loading)
${this.config.openaiApiKey && this.config.openaiApiKey.trim() ? `OPENAI_API_KEY=${this.config.openaiApiKey.trim()}` : '# OPENAI_API_KEY=sk_your_key_here'}

# Discord Bot (Optional - for monitoring Discord channels)
${this.config.discordEnabled ? `DISCORD_ENABLED=true
DISCORD_BOT_TOKEN=${this.config.discordBotToken}
DISCORD_GUILD_ID=${this.config.discordGuildId}
DISCORD_CHANNEL_IDS=${this.config.discordChannelIds}
DISCORD_KEYWORDS=bug,issue,error,problem,broken,crash,fix
DISCORD_POLL_INTERVAL_MS=600000` : `# DISCORD_ENABLED=false
# DISCORD_BOT_TOKEN=your_token_here
# DISCORD_GUILD_ID=your_guild_id_here
# DISCORD_CHANNEL_IDS=channel_id_1,channel_id_2
# DISCORD_KEYWORDS=bug,issue,error,problem,broken,crash,fix
# DISCORD_POLL_INTERVAL_MS=600000`}

# ============================================
# SYSTEM SETTINGS
# ============================================

# Polling interval (milliseconds)
POLL_INTERVAL_MS=${this.config.pollInterval}

# CLI paths (auto-detected if not specified)
CLAUDE_CLI_PATH=/Users/${process.env.USER}/.local/bin/claude
GEMINI_CLI_PATH=gemini
CODEX_CLI_PATH=codex
QWEN_CLI_PATH=qwen

# ============================================
# FEATURE FLAGS
# ============================================

# Disable all commenting (ClickUp and GitHub)
DISABLE_COMMENTS=${this.config.disableComments}

# Auto-create GitHub repos when task specifies non-existent repo
AUTO_CREATE_REPO=${this.config.autoCreateRepo}
AUTO_REPO_PRIVATE=true
AUTO_REPO_BASE_DIR=/Users/${process.env.USER}/Documents/Personal-Projects
AUTO_REPO_DEFAULT_BRANCH=${this.config.baseBranch}
GITHUB_DEFAULT_USERNAME=${this.config.githubUsername}

# ============================================
# CONTEXT LOADING CONFIGURATION
# ============================================

# Context mode: 'free' (Smart Loader), 'premium' (RAG), or 'hybrid' (both)
CONTEXT_MODE=hybrid

# Fallback to Smart Loader if RAG fails
CONTEXT_FALLBACK=true

# Enable context caching
CONTEXT_CACHE_ENABLED=true
CONTEXT_CACHE_TTL=3600

# ============================================
# PROJECT CONFIGURATION
# ============================================
# Project-specific settings are now in:
# - projects.json: All your projects with their ClickUp/GitHub configs
# - workspace.json: Currently active project
#
# To switch projects: npm run switch <project-name>
# To list projects: npm run projects
# To modify settings: npm run settings
#
`;

    fs.writeFileSync('.env', envContent);
    this.log('  ✓ Created .env', 'green');

    // Create projects.json
    const projectsContent = {
      projects: {
        [this.config.projectName!]: {
          name: this.config.projectName,
          description: this.config.projectDescription,
          clickup: {
            workspaceId: this.config.clickupWorkspaceId,
          },
          github: {
            owner: this.config.repoOwner,
            repo: this.config.repoName,
            path: this.config.repoPath,
            baseBranch: this.config.baseBranch,
          },
        },
      },
    };

    fs.writeFileSync('projects.json', JSON.stringify(projectsContent, null, 2));
    this.log('  ✓ Created projects.json', 'green');

    // Create workspace.json
    const workspaceContent = {
      activeProject: this.config.projectName,
    };

    fs.writeFileSync('workspace.json', JSON.stringify(workspaceContent, null, 2));
    this.log('  ✓ Created workspace.json', 'green');

    // Create directories and copy templates
    const dirs = [
      'logs',
      'progress',
      'features',
      'data/cache',
      'data/state',
      'data/tracking',
      'data/cache/embeddings',
      '.context/models',
      '.context/shared',
      '.context/projects',
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Copy context templates
    const contextTemplates = [
      { from: 'templates/.context/models/claude.md', to: '.context/models/claude.md' },
      { from: 'templates/.context/models/gemini.md', to: '.context/models/gemini.md' },
      { from: 'templates/.context/models/codex.md', to: '.context/models/codex.md' },
      { from: 'templates/.context/shared/architecture.md', to: '.context/shared/architecture.md' },
    ];

    for (const template of contextTemplates) {
      if (fs.existsSync(template.from) && !fs.existsSync(template.to)) {
        fs.copyFileSync(template.from, template.to);
      }
    }

    // Create initial data files
    const dataFiles = [
      { path: 'data/cache/processed-tasks.json', content: '[]' },
      { path: 'data/cache/processed-comments.json', content: '[]' },
      { path: 'data/state/task-queue.json', content: '[]' },
      { path: 'data/state/pipeline-state.json', content: '{}' },
      { path: 'data/tracking/pr-tracking.json', content: '{}' },
      { path: 'data/tracking/review-tracking.json', content: '{}' },
    ];

    for (const file of dataFiles) {
      if (!fs.existsSync(file.path)) {
        fs.writeFileSync(file.path, file.content);
      }
    }

    this.log('  ✓ Created directories and data files', 'green');
  }
}

// Run setup
const setup = new InteractiveSetup();
setup.run().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
