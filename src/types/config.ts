/**
 * Configuration Types
 * Types for application configuration and repository settings
 */

export interface RepositoryConfig {
  readonly owner: string;
  readonly repo: string;
  readonly path: string;
  readonly baseBranch: string;
  readonly token?: string;
}

export interface ReposConfig {
  readonly default: string | null;
  readonly repositories: {
    readonly [key: string]: RepositoryConfig;
  };
}

export interface ClickUpConfig {
  readonly apiKey: string | undefined;
  readonly botUserId: number;
  readonly workspaceId: string | undefined;
}

export interface GitHubConfig {
  readonly repoPath: string | undefined;
  readonly owner: string | undefined;
  readonly repo: string | undefined;
  readonly token: string | undefined;
}

export interface SystemConfig {
  readonly pollIntervalMs: number;
  readonly claudeCliPath: string;
  readonly geminiCliPath: string;
  readonly codexCliPath: string;
}

export interface AutoRepoConfig {
  readonly enabled: boolean;
  readonly isPrivate: boolean;
  readonly baseDir: string;
  readonly defaultBranch: string;
}

export interface FilesConfig {
  readonly cacheFile: string;
  readonly queueFile: string;
  readonly prTrackingFile: string;
  readonly pipelineFile: string;
  readonly featuresDir: string;
  readonly reposConfig: string;
}

export interface PRTrackingConfig {
  readonly checkIntervalMs: number;
  readonly timeoutMs: number;
}

export interface AppConfig {
  readonly clickup: ClickUpConfig;
  readonly github: GitHubConfig;
  readonly system: SystemConfig;
  readonly autoRepo: AutoRepoConfig;
  readonly files: FilesConfig;
  readonly prTracking: PRTrackingConfig;
  readonly repos: ReposConfig;
}
