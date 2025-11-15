/**
 * GitHub API Client
 * Handles all interactions with GitHub API
 */

import { BaseAPIClient, BaseClientConfig } from './base.client';
import {
  GitHubBranchResult,
  GitHubPRResult,
  GitHubPRQueryResult,
  GitHubDeleteBranchResult,
  GitHubCommentResult,
} from '../../types';
import { GitHubAPIError } from '../../shared/errors';

export interface GitHubClientConfig extends Partial<BaseClientConfig> {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
}

export class GitHubClient extends BaseAPIClient {
  private readonly owner: string;
  private readonly repo: string;

  constructor(config: GitHubClientConfig) {
    super({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: config.timeout,
      retryOptions: config.retryOptions,
    });

    this.owner = config.owner;
    this.repo = config.repo;
  }

  /**
   * Create a new branch from base branch
   */
  async createBranch(branchName: string, baseBranch: string = 'main'): Promise<GitHubBranchResult> {
    try {
      // Get base branch SHA
      const baseRef = await this.get<{ object: { sha: string } }>(
        `/repos/${this.owner}/${this.repo}/git/refs/heads/${baseBranch}`
      );

      const baseSha = baseRef.object.sha;

      // Create new branch
      await this.post(`/repos/${this.owner}/${this.repo}/git/refs`, {
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      return { branch: branchName, sha: baseSha };
    } catch (error) {
      throw new GitHubAPIError(`Failed to create branch ${branchName}: ${(error as Error).message}`);
    }
  }

  /**
   * Create a pull request
   */
  async createPR(
    title: string,
    body: string,
    headBranch: string,
    baseBranch: string = 'main'
  ): Promise<GitHubPRResult> {
    try {
      const response = await this.post<{ number: number; html_url: string }>(
        `/repos/${this.owner}/${this.repo}/pulls`,
        {
          title,
          body,
          head: headBranch,
          base: baseBranch,
        }
      );

      return {
        number: response.number,
        url: response.html_url,
        branch: headBranch,
      };
    } catch (error) {
      throw new GitHubAPIError(`Failed to create PR: ${(error as Error).message}`);
    }
  }

  /**
   * Get pull request by branch name
   */
  async getPRByBranch(branchName: string): Promise<GitHubPRQueryResult> {
    try {
      const response = await this.get<Array<{ number: number; html_url: string; state: string }>>(
        `/repos/${this.owner}/${this.repo}/pulls`,
        {
          params: {
            head: `${this.owner}:${branchName}`,
            state: 'all',
          },
        }
      );

      if (response && response.length > 0) {
        const pr = response[0];
        return {
          found: true,
          number: pr.number,
          url: pr.html_url,
          state: pr.state,
        };
      }

      return { found: false };
    } catch (error) {
      throw new GitHubAPIError(`Failed to get PR for branch ${branchName}: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string): Promise<GitHubDeleteBranchResult> {
    try {
      await this.delete(`/repos/${this.owner}/${this.repo}/git/refs/heads/${branchName}`);
      return { deleted: true, branch: branchName };
    } catch (error) {
      throw new GitHubAPIError(`Failed to delete branch ${branchName}: ${(error as Error).message}`);
    }
  }

  /**
   * Check if branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      await this.get(`/repos/${this.owner}/${this.repo}/git/refs/heads/${branchName}`);
      return true;
    } catch (error) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get branch commit SHA
   */
  async getBranchSHA(branchName: string): Promise<string> {
    try {
      const response = await this.get<{ object: { sha: string } }>(
        `/repos/${this.owner}/${this.repo}/git/refs/heads/${branchName}`
      );
      return response.object.sha;
    } catch (error) {
      throw new GitHubAPIError(`Failed to get SHA for branch ${branchName}: ${(error as Error).message}`);
    }
  }

  /**
   * Add comment to PR
   */
  async addPRComment(prNumber: number, comment: string): Promise<GitHubCommentResult> {
    try {
      await this.post(
        `/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`,
        { body: comment }
      );
      return { success: true };
    } catch (error) {
      throw new GitHubAPIError(`Failed to add comment to PR #${prNumber}: ${(error as Error).message}`);
    }
  }

  /**
   * Get commits for a branch
   */
  async getCommits(branchName: string, perPage: number = 10): Promise<unknown[]> {
    try {
      return await this.get<unknown[]>(
        `/repos/${this.owner}/${this.repo}/commits`,
        {
          params: {
            sha: branchName,
            per_page: perPage,
          },
        }
      );
    } catch (error) {
      throw new GitHubAPIError(`Failed to get commits for branch ${branchName}: ${(error as Error).message}`);
    }
  }
}
