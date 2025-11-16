/**
 * Config Repository Tests
 */

import fs from 'fs';
import { ConfigRepository } from '../config.repository';
import { FileReadError, FileWriteError, RepositoryNotFoundError } from '../../../shared/errors';
import { createTempDir, cleanupTempDir } from '../../../test-setup';
import type { ReposConfig, RepositoryConfig } from '../../../types';

describe('ConfigRepository', () => {
  let tempDir: string;
  let configFilePath: string;
  let repository: ConfigRepository;

  beforeEach(() => {
    tempDir = createTempDir('config-test');
    configFilePath = `${tempDir}/repos.json`;
    repository = new ConfigRepository(configFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return default config when file does not exist', async () => {
      const config = await repository.load();
      expect(config).toEqual({
        default: null,
        repositories: {},
      });
    });

    it('should load config from file', async () => {
      const mockConfig: ReposConfig = {
        default: 'repo1',
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'test-owner',
            repo: 'test-repo',
            baseBranch: 'main',
          },
        },
      };
      fs.writeFileSync(configFilePath, JSON.stringify(mockConfig));

      const config = await repository.load();
      expect(config).toEqual(mockConfig);
    });

    it('should throw FileReadError on invalid JSON', async () => {
      fs.writeFileSync(configFilePath, 'invalid json');

      await expect(repository.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save config to file', async () => {
      const config: ReposConfig = {
        default: 'repo1',
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'test-owner',
            repo: 'test-repo',
            baseBranch: 'main',
          },
        },
      };

      await repository.save(config);

      const fileContent = fs.readFileSync(configFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(config);
    });

    it('should throw FileWriteError when file cannot be written', async () => {
      const invalidRepo = new ConfigRepository('/invalid/path/repos.json');
      const config: ReposConfig = { default: null, repositories: {} };

      await expect(invalidRepo.save(config)).rejects.toThrow(FileWriteError);
    });

    it('should format JSON with 2-space indentation', async () => {
      const config: ReposConfig = {
        default: 'repo1',
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'test-owner',
            repo: 'test-repo',
            baseBranch: 'main',
          },
        },
      };

      await repository.save(config);

      const fileContent = fs.readFileSync(configFilePath, 'utf8');
      expect(fileContent).toContain('  ');
    });
  });

  describe('getRepository', () => {
    beforeEach(async () => {
      const config: ReposConfig = {
        default: 'repo1',
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'test-owner',
            repo: 'test-repo',
            baseBranch: 'main',
          },
        },
      };
      await repository.save(config);
      await repository.load();
    });

    it('should return repository config when it exists', async () => {
      const repoConfig = await repository.getRepository('repo1');

      expect(repoConfig).toEqual({
        path: '/path/to/repo1',
        owner: 'test-owner',
        repo: 'test-repo',
            baseBranch: 'main',
      });
    });

    it('should return null when repository does not exist', async () => {
      const repoConfig = await repository.getRepository('non-existent');

      expect(repoConfig).toBeNull();
    });
  });

  describe('addRepository', () => {
    beforeEach(async () => {
      await repository.load();
    });

    it('should add new repository', async () => {
      const repoConfig: RepositoryConfig = {
        path: '/path/to/repo',
        owner: 'test-owner',
        repo: 'test-repo',
            baseBranch: 'main',
      };

      await repository.addRepository('repo1', repoConfig);

      const config = await repository.load();
      expect(config.repositories.repo1).toEqual(repoConfig);
    });

    it('should persist to file', async () => {
      const repoConfig: RepositoryConfig = {
        path: '/path/to/repo',
        owner: 'test-owner',
        repo: 'test-repo',
            baseBranch: 'main',
      };

      await repository.addRepository('repo1', repoConfig);

      const fileContent = fs.readFileSync(configFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.repositories.repo1).toEqual(repoConfig);
    });

    it('should set as default if first repository', async () => {
      const repoConfig: RepositoryConfig = {
        path: '/path/to/repo',
        owner: 'test-owner',
        repo: 'test-repo',
            baseBranch: 'main',
      };

      await repository.addRepository('repo1', repoConfig);

      const config = await repository.load();
      expect(config.default).toBe('repo1');
    });

    it('should not change default when adding second repository', async () => {
      const repoConfig1: RepositoryConfig = {
        path: '/path/to/repo1',
        owner: 'owner1',
        repo: 'repo1',
            baseBranch: 'main',
      };
      const repoConfig2: RepositoryConfig = {
        path: '/path/to/repo2',
        owner: 'owner2',
        repo: 'repo2',
            baseBranch: 'develop',
      };

      await repository.addRepository('repo1', repoConfig1);
      await repository.addRepository('repo2', repoConfig2);

      const config = await repository.load();
      expect(config.default).toBe('repo1');
    });

    it('should update existing repository', async () => {
      const repoConfig1: RepositoryConfig = {
        path: '/path/to/repo1',
        owner: 'owner1',
        repo: 'repo1',
            baseBranch: 'main',
      };
      const repoConfig2: RepositoryConfig = {
        path: '/path/to/repo1-updated',
        baseBranch: 'main',
        owner: 'owner1-updated',
        repo: 'repo1-updated',
      };

      await repository.addRepository('repo1', repoConfig1);
      await repository.addRepository('repo1', repoConfig2);

      const config = await repository.load();
      expect(config.repositories.repo1).toEqual(repoConfig2);
    });

    it('should list all repositories', async () => {
      const repoConfig1: RepositoryConfig = {
        path: '/path/to/repo1',
        owner: 'owner1',
        repo: 'repo1',
            baseBranch: 'main',
      };
      const repoConfig2: RepositoryConfig = {
        path: '/path/to/repo2',
        owner: 'owner2',
        repo: 'repo2',
            baseBranch: 'develop',
      };

      await repository.addRepository('repo1', repoConfig1);
      await repository.addRepository('repo2', repoConfig2);

      const repos = await repository.listRepositories();
      expect(repos).toHaveLength(2);
      expect(repos).toContain('repo1');
      expect(repos).toContain('repo2');
    });
  });

  describe('removeRepository', () => {
    beforeEach(async () => {
      const config: ReposConfig = {
        default: 'repo1',
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'owner1',
            repo: 'repo1',
            baseBranch: 'main',
          },
          repo2: {
            path: '/path/to/repo2',
            owner: 'owner2',
            repo: 'repo2',
            baseBranch: 'develop',
          },
        },
      };
      await repository.save(config);
      await repository.load();
    });

    it('should remove repository', async () => {
      await repository.removeRepository('repo2');

      const config = await repository.load();
      expect(config.repositories.repo2).toBeUndefined();
      expect(config.repositories.repo1).toBeDefined();
    });

    it('should persist to file', async () => {
      await repository.removeRepository('repo2');

      const fileContent = fs.readFileSync(configFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.repositories.repo2).toBeUndefined();
    });

    it('should clear default if removing default repository', async () => {
      await repository.removeRepository('repo1');

      const config = await repository.load();
      expect(config.default).toBeNull();
    });

    it('should not clear default if removing non-default repository', async () => {
      await repository.removeRepository('repo2');

      const config = await repository.load();
      expect(config.default).toBe('repo1');
    });

    it('should handle removing non-existent repository', async () => {
      await repository.removeRepository('non-existent');

      const config = await repository.load();
      expect(Object.keys(config.repositories)).toHaveLength(2);
    });
  });

  describe('listRepositories', () => {
    beforeEach(async () => {
      await repository.load();
    });

    it('should return empty array when no repositories', async () => {
      const repos = await repository.listRepositories();
      expect(repos).toEqual([]);
    });

    it('should return all repository names', async () => {
      const repoConfig1: RepositoryConfig = {
        path: '/path/to/repo1',
        owner: 'owner1',
        repo: 'repo1',
            baseBranch: 'main',
      };
      const repoConfig2: RepositoryConfig = {
        path: '/path/to/repo2',
        owner: 'owner2',
        repo: 'repo2',
            baseBranch: 'develop',
      };

      await repository.addRepository('repo1', repoConfig1);
      await repository.addRepository('repo2', repoConfig2);

      const repos = await repository.listRepositories();
      expect(repos).toHaveLength(2);
      expect(repos).toContain('repo1');
      expect(repos).toContain('repo2');
    });
  });

  describe('getDefault', () => {
    it('should return null when no default set', async () => {
      await repository.load();

      const defaultRepo = await repository.getDefault();
      expect(defaultRepo).toBeNull();
    });

    it('should return default repository name', async () => {
      const config: ReposConfig = {
        default: 'repo1',
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'owner1',
            repo: 'repo1',
            baseBranch: 'main',
          },
        },
      };
      await repository.save(config);
      await repository.load();

      const defaultRepo = await repository.getDefault();
      expect(defaultRepo).toBe('repo1');
    });
  });

  describe('setDefault', () => {
    beforeEach(async () => {
      const config: ReposConfig = {
        default: null,
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'owner1',
            repo: 'repo1',
            baseBranch: 'main',
          },
          repo2: {
            path: '/path/to/repo2',
            owner: 'owner2',
            repo: 'repo2',
            baseBranch: 'develop',
          },
        },
      };
      await repository.save(config);
      await repository.load();
    });

    it('should set default repository', async () => {
      await repository.setDefault('repo1');

      const config = await repository.load();
      expect(config.default).toBe('repo1');
    });

    it('should persist to file', async () => {
      await repository.setDefault('repo1');

      const fileContent = fs.readFileSync(configFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed.default).toBe('repo1');
    });

    it('should throw RepositoryNotFoundError when repository does not exist', async () => {
      await expect(repository.setDefault('non-existent')).rejects.toThrow(
        RepositoryNotFoundError
      );
    });

    it('should update existing default', async () => {
      await repository.setDefault('repo1');
      await repository.setDefault('repo2');

      const config = await repository.load();
      expect(config.default).toBe('repo2');
    });
  });

  describe('init', () => {
    it('should load config from file', async () => {
      const mockConfig: ReposConfig = {
        default: 'repo1',
        repositories: {
          repo1: {
            path: '/path/to/repo1',
            owner: 'owner1',
            repo: 'repo1',
            baseBranch: 'main',
          },
        },
      };
      fs.writeFileSync(configFilePath, JSON.stringify(mockConfig));

      await repository.init();

      const defaultRepo = await repository.getDefault();
      expect(defaultRepo).toBe('repo1');
    });

    it('should initialize with default config if file does not exist', async () => {
      await repository.init();

      const defaultRepo = await repository.getDefault();
      expect(defaultRepo).toBeNull();

      const repos = await repository.listRepositories();
      expect(repos).toEqual([]);
    });
  });
});
