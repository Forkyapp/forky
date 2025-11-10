const path = require('path');
const fs = require('fs');

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

// Load .env file AFTER unsetting system variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Load repos.json for multi-repository support
const reposConfigPath = path.join(__dirname, '..', 'repos.json');
let reposConfig = { default: null, repositories: {} };

if (fs.existsSync(reposConfigPath)) {
  try {
    reposConfig = JSON.parse(fs.readFileSync(reposConfigPath, 'utf8'));
  } catch (error) {
    console.error('Failed to load repos.json:', error.message);
  }
}

const config = {
  clickup: {
    apiKey: process.env.CLICKUP_API_KEY,
    botUserId: parseInt(process.env.CLICKUP_BOT_USER_ID || '0'),
    workspaceId: process.env.CLICKUP_WORKSPACE_ID,
  },
  github: {
    // Legacy: Fallback to .env if repos.json not available
    repoPath: process.env.GITHUB_REPO_PATH,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN,
  },
  system: {
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '15000'),
    claudeCliPath: process.env.CLAUDE_CLI_PATH || 'claude',
    geminiCliPath: process.env.GEMINI_CLI_PATH || 'gemini',
    codexCliPath: process.env.CODEX_CLI_PATH || 'codex',
  },
  autoRepo: {
    enabled: process.env.AUTO_CREATE_REPO !== 'false', // Default: true
    isPrivate: process.env.AUTO_REPO_PRIVATE !== 'false', // Default: true (create private repos)
    baseDir: process.env.AUTO_REPO_BASE_DIR || path.join(process.env.HOME, 'Documents', 'Personal-Projects'),
    defaultBranch: process.env.AUTO_REPO_DEFAULT_BRANCH || 'main'
  },
  files: {
    cacheFile: path.join(__dirname, '..', 'processed-tasks.json'),
    queueFile: path.join(__dirname, '..', 'task-queue.json'),
    prTrackingFile: path.join(__dirname, '..', 'pr-tracking.json'),
    pipelineFile: path.join(__dirname, '..', 'pipeline-state.json'),
    featuresDir: path.join(__dirname, '..', 'docs', 'features'),
    reposConfig: reposConfigPath,
  },
  prTracking: {
    checkIntervalMs: 30000,
    timeoutMs: 30 * 60 * 1000,
  },
  repos: reposConfig,
};

/**
 * Resolve repository configuration for a task
 * @param {string|null} repoName - Repository name or null for default
 * @returns {object} Repository configuration with owner, repo, path, baseBranch, token
 */
function resolveRepoConfig(repoName = null) {
  // Use provided repo name or fall back to default
  const targetRepo = repoName || config.repos.default;

  // If repos.json has the repository, use it
  if (targetRepo && config.repos.repositories[targetRepo]) {
    return {
      ...config.repos.repositories[targetRepo],
      token: process.env.GITHUB_TOKEN, // Always use token from .env
    };
  }

  // Fallback to .env configuration (legacy support)
  return {
    owner: config.github.owner,
    repo: config.github.repo,
    path: config.github.repoPath,
    baseBranch: process.env.GITHUB_BASE_BRANCH || 'main',
    token: process.env.GITHUB_TOKEN,
  };
}

/**
 * Get all available repository names
 * @returns {string[]} Array of repository names
 */
function getAvailableRepos() {
  return Object.keys(config.repos.repositories);
}

module.exports = config;
module.exports.resolveRepoConfig = resolveRepoConfig;
module.exports.getAvailableRepos = getAvailableRepos;
