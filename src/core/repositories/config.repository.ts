/**
 * Config Repository
 * Manages repository configuration file (repos.json)
 */

import fs from 'fs';
import { ReposConfig, RepositoryConfig } from '../../types';
import { FileReadError, FileWriteError, RepositoryNotFoundError } from '../../shared/errors';

export interface IConfigRepository {
  load(): Promise<ReposConfig>;
  save(config: ReposConfig): Promise<void>;
  getRepository(name: string): Promise<RepositoryConfig | null>;
  addRepository(name: string, config: RepositoryConfig): Promise<void>;
  removeRepository(name: string): Promise<void>;
  listRepositories(): Promise<string[]>;
  getDefault(): Promise<string | null>;
  setDefault(name: string): Promise<void>;
}

export class ConfigRepository implements IConfigRepository {
  private config: ReposConfig = { default: null, repositories: {} };

  constructor(private readonly filePath: string) {}

  /**
   * Load repository configuration from file
   */
  async load(): Promise<ReposConfig> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { default: null, repositories: {} };
      }

      const content = fs.readFileSync(this.filePath, 'utf8');
      this.config = JSON.parse(content);
      return this.config;
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  /**
   * Save repository configuration to file
   */
  async save(config: ReposConfig): Promise<void> {
    try {
      this.config = config;
      fs.writeFileSync(this.filePath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Get repository configuration by name
   */
  async getRepository(name: string): Promise<RepositoryConfig | null> {
    if (this.config.repositories[name]) {
      return this.config.repositories[name];
    }
    return null;
  }

  /**
   * Add or update repository configuration
   */
  async addRepository(name: string, config: RepositoryConfig): Promise<void> {
    const mutableConfig = { ...this.config };
    mutableConfig.repositories = {
      ...mutableConfig.repositories,
      [name]: config,
    };

    // Set as default if it's the first repository
    if (Object.keys(mutableConfig.repositories).length === 1 && !mutableConfig.default) {
      mutableConfig.default = name;
    }

    await this.save(mutableConfig);
  }

  /**
   * Remove repository configuration
   */
  async removeRepository(name: string): Promise<void> {
    const mutableConfig = { ...this.config };
    const mutableRepos = { ...mutableConfig.repositories };
    delete mutableRepos[name];
    mutableConfig.repositories = mutableRepos;

    // Clear default if it was this repository
    if (mutableConfig.default === name) {
      mutableConfig.default = null;
    }

    await this.save(mutableConfig);
  }

  /**
   * List all repository names
   */
  async listRepositories(): Promise<string[]> {
    return Object.keys(this.config.repositories);
  }

  /**
   * Get default repository name
   */
  async getDefault(): Promise<string | null> {
    return this.config.default;
  }

  /**
   * Set default repository
   */
  async setDefault(name: string): Promise<void> {
    if (!this.config.repositories[name]) {
      throw new RepositoryNotFoundError(name);
    }

    const mutableConfig = { ...this.config, default: name };
    await this.save(mutableConfig);
  }

  /**
   * Initialize repository (load from file)
   */
  async init(): Promise<void> {
    await this.load();
  }
}
