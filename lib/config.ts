import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

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
dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface RepositoryConfig {
  owner: string;
  repo: string;
  path: string;
  baseBranch: string;
  token?: string;
}

interface ReposConfig {
  default: string | null;
  repositories: {
    [key: string]: RepositoryConfig;
  };
}

interface Config {
  clickup: {
    apiKey: string | undefined;
    botUserId: number;
    workspaceId: string | undefined;
  };
  github: {
    repoPath: string | undefined;
    owner: string | undefined;
    repo: string | undefined;
    token: string | undefined;
  };
  system: {
    pollIntervalMs: number;
    claudeCliPath: string;
    geminiCliPath: string;
    codexCliPath: string;
  };
  autoRepo: {
    enabled: boolean;
    isPrivate: boolean;
    baseDir: string;
    defaultBranch: string;
  };
  files: {
    cacheFile: string;
    queueFile: string;
    prTrackingFile: string;
    pipelineFile: string;
    featuresDir: string;
    reposConfig: string;
  };
  prTracking: {
    checkIntervalMs: number;
    timeoutMs: number;
  };
  repos: ReposConfig;
}

// Load repos.json for multi-repository support
const reposConfigPath = path.join(__dirname, '..', 'repos.json');
let reposConfig: ReposConfig = { default: null, repositories: {} };

if (fs.existsSync(reposConfigPath)) {
  try {
    reposConfig = JSON.parse(fs.readFileSync(reposConfigPath, 'utf8')) as ReposConfig;
  } catch (error) {
    console.error('Failed to load repos.json:', (error as Error).message);
  }
}

const config: Config = {
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
    baseDir: process.env.AUTO_REPO_BASE_DIR || path.join(process.env.HOME || '', 'Documents', 'Personal-Projects'),
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
 * @param repoName - Repository name or null for default
 * @returns Repository configuration with owner, repo, path, baseBranch, token
 */
function resolveRepoConfig(repoName: string | null = null): RepositoryConfig {
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
    owner: config.github.owner || '',
    repo: config.github.repo || '',
    path: config.github.repoPath || '',
    baseBranch: process.env.GITHUB_BASE_BRANCH || 'main',
    token: process.env.GITHUB_TOKEN,
  };
}

/**
 * Get all available repository names
 * @returns Array of repository names
 */
function getAvailableRepos(): string[] {
  return Object.keys(config.repos.repositories);
}

export default config;
export { resolveRepoConfig, getAvailableRepos, Config, RepositoryConfig, ReposConfig };
