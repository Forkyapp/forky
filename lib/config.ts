import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { workspace as workspaceManager } from './workspace';
import type { ProjectConfig } from './workspace';

// Load .env file for global credentials
dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface RepositoryConfig {
  owner: string;
  repo: string;
  path: string;
  baseBranch: string;
  token?: string;
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
  };
  prTracking: {
    checkIntervalMs: number;
    timeoutMs: number;
  };
}

// Load active project from workspace
const activeProject: ProjectConfig | null = workspaceManager.getActiveProject();

const config: Config = {
  clickup: {
    apiKey: process.env.CLICKUP_API_KEY,
    botUserId: parseInt(process.env.CLICKUP_BOT_USER_ID || '0'),
    // Use active project's workspace ID, or fall back to .env
    workspaceId: activeProject?.clickup.workspaceId || process.env.CLICKUP_WORKSPACE_ID,
  },
  github: {
    // Use active project's GitHub config, or fall back to .env
    repoPath: activeProject?.github.path || process.env.GITHUB_REPO_PATH,
    owner: activeProject?.github.owner || process.env.GITHUB_OWNER,
    repo: activeProject?.github.repo || process.env.GITHUB_REPO,
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
    cacheFile: path.join(__dirname, '..', 'data', 'cache', 'processed-tasks.json'),
    queueFile: path.join(__dirname, '..', 'data', 'state', 'task-queue.json'),
    prTrackingFile: path.join(__dirname, '..', 'data', 'tracking', 'pr-tracking.json'),
    pipelineFile: path.join(__dirname, '..', 'data', 'state', 'pipeline-state.json'),
    featuresDir: path.join(__dirname, '..', 'docs', 'features'),
  },
  prTracking: {
    checkIntervalMs: 30000,
    timeoutMs: 30 * 60 * 1000,
  },
};

/**
 * Resolve repository configuration for active project
 * Uses workspace.json + projects.json system
 * @returns Repository configuration with owner, repo, path, baseBranch, token
 */
function resolveRepoConfig(): RepositoryConfig {
  if (activeProject) {
    return {
      owner: activeProject.github.owner,
      repo: activeProject.github.repo,
      path: activeProject.github.path,
      baseBranch: activeProject.github.baseBranch,
      token: process.env.GITHUB_TOKEN,
    };
  }

  // Fallback to config (from .env)
  return {
    owner: config.github.owner || '',
    repo: config.github.repo || '',
    path: config.github.repoPath || '',
    baseBranch: 'main',
    token: process.env.GITHUB_TOKEN,
  };
}

export default config;
export { resolveRepoConfig, Config, RepositoryConfig };
