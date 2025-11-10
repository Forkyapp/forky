import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import config, { RepositoryConfig, resolveRepoConfig } from './config';
import { forky, colors } from './ui';

const execAsync = promisify(exec);

interface RepoInfo {
  owner: string;
  repo: string;
  url: string;
  cloned: boolean;
}

interface EnsureRepoOptions {
  owner?: string | null;
  autoCreate?: boolean;
  baseDir?: string;
  isPrivate?: boolean;
  baseBranch?: string;
}

/**
 * Check if repository exists in repos.json
 * @param repoName - Repository name
 * @returns True if exists
 */
function repositoryExists(repoName: string): boolean {
  return config.repos.repositories[repoName] !== undefined;
}

/**
 * Get GitHub username from gh CLI or config
 * @returns GitHub username
 */
async function getGitHubUsername(): Promise<string> {
  // Try to get from environment variable first
  if (process.env.GITHUB_DEFAULT_USERNAME) {
    console.log(forky.info(`Using GitHub username from env: ${process.env.GITHUB_DEFAULT_USERNAME}`));
    return process.env.GITHUB_DEFAULT_USERNAME;
  }

  // Try gh CLI
  try {
    const { stdout } = await execAsync('gh api user --jq .login', {
      timeout: 10000
    });
    return stdout.trim();
  } catch (error) {
    console.log(forky.warning('Failed to get GitHub username from gh CLI'));

    // Fallback to default username
    const defaultUsername = 'kuxala';
    console.log(forky.info(`Using default GitHub username: ${defaultUsername}`));
    return defaultUsername;
  }
}

/**
 * Create a new private GitHub repository
 * @param repoName - Name of the repository
 * @param owner - GitHub username or organization
 * @param options - Additional options
 * @returns Repository information
 */
async function createGitHubRepo(
  repoName: string,
  owner: string,
  options: { description?: string; isPrivate?: boolean } = {}
): Promise<RepoInfo> {
  const {
    description = `Auto-created repository for ${repoName}`,
    isPrivate = true
  } = options;

  console.log(forky.processing(`Creating GitHub repository ${colors.bright}${owner}/${repoName}${colors.reset}...`));

  try {
    const privateFlag = isPrivate ? '--private' : '--public';

    // Try to create repo on GitHub using gh CLI
    await execAsync(
      `gh repo create ${owner}/${repoName} ${privateFlag} --description "${description}" --clone`,
      {
        timeout: 60000,
        cwd: path.join(process.env.HOME || '', 'Documents', 'Personal-Projects')
      }
    );

    console.log(forky.success(`Repository created: ${colors.bright}${owner}/${repoName}${colors.reset}`));

    return {
      owner,
      repo: repoName,
      url: `https://github.com/${owner}/${repoName}`,
      cloned: true
    };
  } catch (error) {
    console.log(forky.warning(`Could not auto-create via gh CLI: ${(error as Error).message}`));
    console.log(forky.info(`Please create the repository manually:`));
    console.log(forky.info(`1. Visit: https://github.com/new`));
    console.log(forky.info(`2. Name: ${repoName}`));
    console.log(forky.info(`3. Visibility: ${isPrivate ? 'Private' : 'Public'}`));
    console.log(forky.info(`4. Click "Create repository"`));

    throw new Error(`Please create repository manually at https://github.com/new (name: ${repoName}, private: ${isPrivate})`);
  }
}

/**
 * Clone repository to local path
 * @param owner - GitHub username or organization
 * @param repoName - Repository name
 * @param targetPath - Local path to clone to
 */
async function cloneRepository(owner: string, repoName: string, targetPath: string): Promise<void> {
  console.log(forky.processing(`Cloning repository to ${colors.bright}${targetPath}${colors.reset}...`));

  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Clone repository
    await execAsync(
      `gh repo clone ${owner}/${repoName} "${targetPath}"`,
      {
        timeout: 60000
      }
    );

    console.log(forky.success(`Repository cloned to ${targetPath}`));
  } catch (error) {
    console.log(forky.error(`Failed to clone repository: ${(error as Error).message}`));
    throw error;
  }
}

/**
 * Add repository to repos.json
 * @param repoName - Repository identifier/key
 * @param repoConfig - Repository configuration
 */
async function addToReposConfig(repoName: string, repoConfig: RepositoryConfig): Promise<void> {
  const reposConfigPath = config.files.reposConfig;

  try {
    // Read current config
    let reposData: { default: string | null; repositories: Record<string, RepositoryConfig> } = {
      default: null,
      repositories: {}
    };
    if (fs.existsSync(reposConfigPath)) {
      reposData = JSON.parse(fs.readFileSync(reposConfigPath, 'utf8'));
    }

    // Add new repository
    reposData.repositories[repoName] = repoConfig;

    // Write back to file
    fs.writeFileSync(reposConfigPath, JSON.stringify(reposData, null, 2));

    console.log(forky.success(`Added ${colors.bright}${repoName}${colors.reset} to repos.json`));

    // Reload config in memory
    config.repos.repositories[repoName] = repoConfig;
  } catch (error) {
    console.log(forky.error(`Failed to update repos.json: ${(error as Error).message}`));
    throw error;
  }
}

/**
 * Auto-create repository if it doesn't exist
 * @param repoName - Repository name/identifier
 * @param options - Creation options
 * @returns Repository configuration
 */
async function ensureRepository(repoName: string, options: EnsureRepoOptions = {}): Promise<RepositoryConfig> {
  // Check if repository already exists in config
  if (repositoryExists(repoName)) {
    console.log(forky.info(`Repository ${colors.bright}${repoName}${colors.reset} already configured`));
    return resolveRepoConfig(repoName);
  }

  console.log(forky.warning(`Repository ${colors.bright}${repoName}${colors.reset} not found in repos.json`));

  const {
    owner = null,
    autoCreate = true,
    baseDir = path.join(process.env.HOME || '', 'Documents', 'Personal-Projects'),
    isPrivate = true,
    baseBranch = 'main'
  } = options;

  if (!autoCreate) {
    throw new Error(`Repository "${repoName}" not configured in repos.json. Please add it manually.`);
  }

  // Get GitHub username if owner not provided
  const repoOwner = owner || await getGitHubUsername();

  console.log(forky.ai(`Auto-creating private repository ${colors.bright}${repoOwner}/${repoName}${colors.reset}...`));

  // Determine local path
  const localPath = path.join(baseDir, repoName);

  try {
    // Create GitHub repository and clone it
    const repoInfo = await createGitHubRepo(repoName, repoOwner, {
      isPrivate,
      description: `Auto-created for task automation`
    });

    // Repository is already cloned by gh repo create --clone
    // Just verify it exists
    if (!fs.existsSync(localPath)) {
      // If somehow it wasn't cloned, clone it manually
      await cloneRepository(repoOwner, repoName, localPath);
    }

    // Create repository configuration
    const repoConfig: RepositoryConfig = {
      owner: repoOwner,
      repo: repoName,
      path: localPath,
      baseBranch: baseBranch
    };

    // Add to repos.json
    await addToReposConfig(repoName, repoConfig);

    console.log(forky.success(`Repository ${colors.bright}${repoName}${colors.reset} ready!`));
    console.log(forky.info(`Path: ${localPath}`));
    console.log(forky.info(`URL: ${repoInfo.url}`));

    return {
      ...repoConfig,
      token: process.env.GITHUB_TOKEN
    };

  } catch (error) {
    console.log(forky.error(`Auto-create failed: ${(error as Error).message}`));
    console.log(forky.warning(`Attempting to use existing repository or manual creation...`));

    // Check if repository already exists locally
    if (fs.existsSync(localPath) && fs.existsSync(path.join(localPath, '.git'))) {
      console.log(forky.success(`Found existing local repository at ${localPath}`));

      // Create repository configuration
      const repoConfig: RepositoryConfig = {
        owner: repoOwner,
        repo: repoName,
        path: localPath,
        baseBranch: baseBranch
      };

      // Add to repos.json
      await addToReposConfig(repoName, repoConfig);

      return {
        ...repoConfig,
        token: process.env.GITHUB_TOKEN
      };
    }

    // Repository doesn't exist - give instructions
    console.log(forky.error(`Repository not found locally at: ${localPath}`));
    console.log(forky.info(`\nPlease create the repository manually:`));
    console.log(forky.info(`1. Create on GitHub: https://github.com/new`));
    console.log(forky.info(`   - Name: ${repoName}`));
    console.log(forky.info(`   - Owner: ${repoOwner}`));
    console.log(forky.info(`   - Visibility: Private`));
    console.log(forky.info(`2. Clone it: git clone git@github.com:${repoOwner}/${repoName}.git ${localPath}`));
    console.log(forky.info(`3. Re-run the task\n`));

    throw new Error(`Repository "${repoName}" not found. Please create it manually.`);
  }
}

export {
  repositoryExists,
  getGitHubUsername,
  createGitHubRepo,
  cloneRepository,
  addToReposConfig,
  ensureRepository,
  RepoInfo,
  EnsureRepoOptions
};
