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
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

interface SetupConfig {
  // ClickUp
  clickupApiKey: string;
  clickupSecret: string;
  clickupBotUserId: string;
  clickupWorkspaceId: string;

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
    this.log('\n🔌 Optional Services Configuration', 'bright');
    this.log('These services enhance Timmy\'s capabilities but are not required.\n', 'cyan');

    // OpenAI API
    const useOpenAI = await this.confirm('Configure OpenAI API? (for RAG-based context loading)', false);
    if (useOpenAI) {
      this.log('\n📝 Getting your OpenAI API Key:', 'cyan');
      this.log('  1. Go to: https://platform.openai.com/api-keys', 'cyan');
      this.log('  2. Click "Create new secret key"', 'cyan');
      this.log('  3. Copy the key\n', 'cyan');

      const openBrowser = await this.confirm('Open OpenAI API keys page in browser?', true);
      if (openBrowser) {
        try {
          await execAsync('open https://platform.openai.com/api-keys');
          this.log('✅ Opened OpenAI API keys page in browser\n', 'green');
        } catch {
          // Ignore error if browser doesn't open
        }
      }

      this.config.openaiApiKey = await this.question('OpenAI API Key: ');
    } else {
      this.config.openaiApiKey = '';
    }

    // Discord Bot
    const useDiscord = await this.confirm('\nConfigure Discord Bot? (for monitoring Discord channels)', false);
    if (useDiscord) {
      this.log('\n📝 Setting up Discord Bot:', 'cyan');
      this.log('  1. Go to: https://discord.com/developers/applications', 'cyan');
      this.log('  2. Create a new application', 'cyan');
      this.log('  3. Go to "Bot" section and create a bot', 'cyan');
      this.log('  4. Copy the bot token\n', 'cyan');

      const openDiscord = await this.confirm('Open Discord Developer Portal in browser?', true);
      if (openDiscord) {
        try {
          await execAsync('open https://discord.com/developers/applications');
          this.log('✅ Opened Discord Developer Portal in browser\n', 'green');
        } catch {
          // Ignore error if browser doesn't open
        }
      }

      this.config.discordEnabled = true;
      this.config.discordBotToken = await this.question('Discord Bot Token: ');
      this.config.discordGuildId = await this.question('Discord Guild (Server) ID: ');
      this.log('\nEnter channel IDs to monitor (comma-separated):', 'cyan');
      this.config.discordChannelIds = await this.question('Channel IDs: ');
    } else {
      this.config.discordEnabled = false;
      this.config.discordBotToken = '';
      this.config.discordGuildId = '';
      this.config.discordChannelIds = '';
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

    // OAuth secret (optional)
    const needSecret = await this.confirm('\nDo you have a ClickUp OAuth Secret? (optional)', false);
    if (needSecret) {
      this.config.clickupSecret = await this.question('ClickUp Secret: ');
    } else {
      this.config.clickupSecret = '';
    }

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
  }

  async run(): Promise<void> {
    console.clear();
    this.log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
    this.log('║                                                           ║', 'cyan');
    this.log('║                  🤖 Welcome to Forky!                    ║', 'cyan');
    this.log('║                                                           ║', 'cyan');
    this.log('║          Autonomous Task Automation System                ║', 'cyan');
    this.log('║                                                           ║', 'cyan');
    this.log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
    this.log('\nLet\'s get you set up! This will only take a few minutes.\n');

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
      // Step 1: GitHub Authentication
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log('Step 1/4: GitHub Configuration', 'bright');
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
      this.log('Step 2/5: ClickUp Configuration', 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      await this.configureClickUp();

      // Step 3: Optional Services Configuration
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log('Step 3/5: Optional Services (OpenAI, Discord)', 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      await this.configureOptionalServices();

      // Step 4: Project Configuration
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log('Step 4/5: Project Configuration', 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      this.config.projectName = await this.question('Project name (e.g., "my-app"): ');
      this.config.projectDescription = await this.question('Project description: ');

      this.config.repoOwner = await this.question(`Repository owner (default: ${githubUsername}): `) || githubUsername;
      this.config.repoName = await this.question('Repository name: ');

      this.log('\nEnter the full path where your repository is located:', 'cyan');
      const defaultPath = `/Users/${process.env.USER}/Documents/${this.config.repoName}`;
      this.config.repoPath = await this.question(`Repository path (default: ${defaultPath}): `) || defaultPath;

      this.config.baseBranch = await this.question('Base branch (default: main): ') || 'main';

      // Step 5: System Settings
      this.log('\n' + '='.repeat(60), 'cyan');
      this.log('Step 5/5: System Settings', 'bright');
      this.log('='.repeat(60) + '\n', 'cyan');

      const pollInterval = await this.question('Polling interval in seconds (default: 15): ');
      this.config.pollInterval = pollInterval ? parseInt(pollInterval) * 1000 : 15000;

      this.config.disableComments = await this.confirm('Disable all comments (ClickUp and GitHub)?', false);
      this.config.autoCreateRepo = await this.confirm('Auto-create GitHub repos when needed?', false);

      // Save configuration
      await this.saveConfiguration();

      // Success message
      this.log('\n' + '='.repeat(60), 'green');
      this.log('✅ Setup Complete!', 'green');
      this.log('='.repeat(60) + '\n', 'green');

      this.log('Your configuration has been saved. Next steps:\n', 'bright');
      this.log('  1. Install dependencies: npm install', 'cyan');
      this.log('  2. Build the project: npm run build', 'cyan');
      this.log('  3. Start Forky: npm start', 'cyan');
      this.log('\nTo modify settings later, run: npm run settings\n', 'yellow');

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

# GitHub Token (single token works for all repos you have access to)
GITHUB_TOKEN=${this.config.githubToken}

# OpenAI API Key (Optional - for RAG/embeddings context loading)
${this.config.openaiApiKey ? `OPENAI_API_KEY=${this.config.openaiApiKey}` : '# OPENAI_API_KEY=sk_your_key_here'}

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
