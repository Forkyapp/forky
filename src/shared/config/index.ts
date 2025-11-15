import path from 'path';
import dotenv from 'dotenv';
import { workspace as workspaceManager } from '../../core/workspace/workspace.service';
import type { ProjectConfig } from '../../core/workspace/workspace.service';

// Load .env file for global credentials
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

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
  discord: {
    enabled: boolean;
    token: string | undefined;
    guildId: string | undefined;
    channelIds: string[];
    keywords: string[];
    pollIntervalMs: number;
  };
  openai: {
    apiKey: string | undefined;
  };
  system: {
    pollIntervalMs: number;
    claudeCliPath: string;
    geminiCliPath: string;
    codexCliPath: string;
    qwenCliPath: string;
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
    discordMessagesFile: string;
  };
  prTracking: {
    checkIntervalMs: number;
    timeoutMs: number;
  };
  context: {
    mode: 'free' | 'premium' | 'hybrid';
    openaiApiKey?: string;
    fallback: boolean;
    cache: {
      enabled: boolean;
      ttl: number;
    };
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
  discord: {
    enabled: process.env.DISCORD_ENABLED === 'true',
    token: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    channelIds: process.env.DISCORD_CHANNEL_IDS?.split(',').map(id => id.trim()) || [],
    keywords: process.env.DISCORD_KEYWORDS?.split(',').map(kw => kw.trim().toLowerCase()) || ['bug', 'issue', 'error', 'problem', 'broken', 'crash', 'fix'],
    pollIntervalMs: parseInt(process.env.DISCORD_POLL_INTERVAL_MS || '600000'), // Default: 10 minutes
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  system: {
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '15000'),
    claudeCliPath: process.env.CLAUDE_CLI_PATH || 'claude',
    geminiCliPath: process.env.GEMINI_CLI_PATH || 'gemini',
    codexCliPath: process.env.CODEX_CLI_PATH || 'codex',
    qwenCliPath: process.env.QWEN_CLI_PATH || 'qwen',
  },
  autoRepo: {
    enabled: process.env.AUTO_CREATE_REPO !== 'false', // Default: true
    isPrivate: process.env.AUTO_REPO_PRIVATE !== 'false', // Default: true (create private repos)
    baseDir: process.env.AUTO_REPO_BASE_DIR || path.join(process.env.HOME || '', 'Documents', 'Personal-Projects'),
    defaultBranch: process.env.AUTO_REPO_DEFAULT_BRANCH || 'main'
  },
  files: {
    cacheFile: path.join(__dirname, '..', '..', '..', 'data', 'cache', 'processed-tasks.json'),
    queueFile: path.join(__dirname, '..', '..', '..', 'data', 'state', 'task-queue.json'),
    prTrackingFile: path.join(__dirname, '..', '..', '..', 'data', 'tracking', 'pr-tracking.json'),
    pipelineFile: path.join(__dirname, '..', '..', '..', 'data', 'state', 'pipeline-state.json'),
    featuresDir: path.join(__dirname, '..', '..', '..', 'docs', 'features'),
    discordMessagesFile: path.join(__dirname, '..', '..', '..', 'data', 'discord', 'processed-messages.json'),
  },
  prTracking: {
    checkIntervalMs: 30000,
    timeoutMs: 30 * 60 * 1000,
  },
  context: {
    mode: (process.env.CONTEXT_MODE as 'free' | 'premium' | 'hybrid') || 'hybrid',
    openaiApiKey: process.env.OPENAI_API_KEY,
    fallback: process.env.CONTEXT_FALLBACK !== 'false', // Default: true
    cache: {
      enabled: process.env.CONTEXT_CACHE_ENABLED !== 'false', // Default: true
      ttl: parseInt(process.env.CONTEXT_CACHE_TTL || '3600'), // Default: 1 hour
    },
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
