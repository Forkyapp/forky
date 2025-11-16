/**
 * GitHub API Client Tests
 * Tests for GitHub API interactions
 */

import { GitHubClient } from '../github.client';
import { GitHubAPIError } from '../../../shared/errors';

// Mock axios
jest.mock('axios');

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockGet: jest.Mock;
  let mockPost: jest.Mock;
  let mockDelete: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create client
    client = new GitHubClient({
      token: 'test-github-token',
      owner: 'test-owner',
      repo: 'test-repo',
    });

    // Mock methods
    mockGet = jest.fn();
    mockPost = jest.fn();
    mockDelete = jest.fn();

    (client as any).get = mockGet;
    (client as any).post = mockPost;
    (client as any).delete = mockDelete;
  });

  describe('createBranch', () => {
    it('should create a new branch successfully', async () => {
      const mockBaseRef = {
        object: {
          sha: 'abc123def456',
        },
      };

      mockGet.mockResolvedValue(mockBaseRef);
      mockPost.mockResolvedValue({});

      const result = await client.createBranch('feature/new-branch', 'main');

      // Verify base branch SHA fetched
      expect(mockGet).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/refs/heads/main'
      );

      // Verify new branch created
      expect(mockPost).toHaveBeenCalledWith('/repos/test-owner/test-repo/git/refs', {
        ref: 'refs/heads/feature/new-branch',
        sha: 'abc123def456',
      });

      // Verify result
      expect(result.branch).toBe('feature/new-branch');
      expect(result.sha).toBe('abc123def456');
    });

    it('should use default base branch when not specified', async () => {
      const mockBaseRef = {
        object: { sha: 'abc123' },
      };

      mockGet.mockResolvedValue(mockBaseRef);
      mockPost.mockResolvedValue({});

      await client.createBranch('feature/new-branch');

      // Verify default base branch (main) was used
      expect(mockGet).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/refs/heads/main'
      );
    });

    it('should throw GitHubAPIError on failure', async () => {
      const error = new Error('API error');
      mockGet.mockRejectedValue(error);

      await expect(client.createBranch('feature/new-branch')).rejects.toThrow(GitHubAPIError);
      await expect(client.createBranch('feature/new-branch')).rejects.toThrow(
        'Failed to create branch'
      );
    });

    it('should handle base branch not found', async () => {
      const error = new Error('Not found');
      (error as any).statusCode = 404;
      mockGet.mockRejectedValue(error);

      await expect(client.createBranch('feature/new-branch', 'nonexistent')).rejects.toThrow(
        GitHubAPIError
      );
    });
  });

  describe('createPR', () => {
    it('should create a pull request successfully', async () => {
      const mockPRResponse = {
        number: 42,
        html_url: 'https://github.com/test-owner/test-repo/pull/42',
      };

      mockPost.mockResolvedValue(mockPRResponse);

      const result = await client.createPR(
        'Add new feature',
        'This PR adds a new feature',
        'feature/new-feature',
        'main'
      );

      // Verify PR created
      expect(mockPost).toHaveBeenCalledWith('/repos/test-owner/test-repo/pulls', {
        title: 'Add new feature',
        body: 'This PR adds a new feature',
        head: 'feature/new-feature',
        base: 'main',
      });

      // Verify result
      expect(result.number).toBe(42);
      expect(result.url).toBe('https://github.com/test-owner/test-repo/pull/42');
      expect(result.branch).toBe('feature/new-feature');
    });

    it('should use default base branch when not specified', async () => {
      mockPost.mockResolvedValue({
        number: 42,
        html_url: 'https://github.com/test-owner/test-repo/pull/42',
      });

      await client.createPR('Test PR', 'Test body', 'feature/test');

      // Verify default base branch (main) was used
      expect(mockPost).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/pulls',
        expect.objectContaining({
          base: 'main',
        })
      );
    });

    it('should throw GitHubAPIError on failure', async () => {
      const error = new Error('Validation failed');
      mockPost.mockRejectedValue(error);

      await expect(
        client.createPR('Test', 'Body', 'feature/test')
      ).rejects.toThrow(GitHubAPIError);
      await expect(
        client.createPR('Test', 'Body', 'feature/test')
      ).rejects.toThrow('Failed to create PR');
    });

    it('should handle branch not found error', async () => {
      const error = new Error('Branch not found');
      (error as any).statusCode = 422;
      mockPost.mockRejectedValue(error);

      await expect(
        client.createPR('Test', 'Body', 'nonexistent-branch')
      ).rejects.toThrow(GitHubAPIError);
    });
  });

  describe('getPRByBranch', () => {
    it('should find existing PR by branch', async () => {
      const mockPRs = [
        {
          number: 42,
          html_url: 'https://github.com/test-owner/test-repo/pull/42',
          state: 'open',
        },
      ];

      mockGet.mockResolvedValue(mockPRs);

      const result = await client.getPRByBranch('feature/test-branch');

      // Verify query
      expect(mockGet).toHaveBeenCalledWith('/repos/test-owner/test-repo/pulls', {
        params: {
          head: 'test-owner:feature/test-branch',
          state: 'all',
        },
      });

      // Verify result
      expect(result.found).toBe(true);
      expect(result.number).toBe(42);
      expect(result.url).toBe('https://github.com/test-owner/test-repo/pull/42');
      expect(result.state).toBe('open');
    });

    it('should return not found when no PR exists', async () => {
      mockGet.mockResolvedValue([]);

      const result = await client.getPRByBranch('feature/nonexistent');

      expect(result.found).toBe(false);
      expect(result.number).toBeUndefined();
      expect(result.url).toBeUndefined();
    });

    it('should throw GitHubAPIError on failure', async () => {
      const error = new Error('API error');
      mockGet.mockRejectedValue(error);

      await expect(client.getPRByBranch('feature/test')).rejects.toThrow(GitHubAPIError);
      await expect(client.getPRByBranch('feature/test')).rejects.toThrow(
        'Failed to get PR for branch'
      );
    });

    it('should return first PR when multiple exist', async () => {
      const mockPRs = [
        { number: 42, html_url: 'https://github.com/test/repo/pull/42', state: 'open' },
        { number: 41, html_url: 'https://github.com/test/repo/pull/41', state: 'closed' },
      ];

      mockGet.mockResolvedValue(mockPRs);

      const result = await client.getPRByBranch('feature/test');

      expect(result.number).toBe(42);
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch successfully', async () => {
      mockDelete.mockResolvedValue({});

      const result = await client.deleteBranch('feature/old-branch');

      // Verify delete called
      expect(mockDelete).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/refs/heads/feature/old-branch'
      );

      // Verify result
      expect(result.deleted).toBe(true);
      expect(result.branch).toBe('feature/old-branch');
    });

    it('should throw GitHubAPIError on failure', async () => {
      const error = new Error('Branch not found');
      mockDelete.mockRejectedValue(error);

      await expect(client.deleteBranch('feature/nonexistent')).rejects.toThrow(GitHubAPIError);
      await expect(client.deleteBranch('feature/nonexistent')).rejects.toThrow(
        'Failed to delete branch'
      );
    });
  });

  describe('branchExists', () => {
    it('should return true when branch exists', async () => {
      mockGet.mockResolvedValue({ ref: 'refs/heads/feature/test' });

      const result = await client.branchExists('feature/test');

      expect(mockGet).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/refs/heads/feature/test'
      );
      expect(result).toBe(true);
    });

    it('should return false when branch not found', async () => {
      const error = new Error('Not found');
      (error as any).statusCode = 404;
      mockGet.mockRejectedValue(error);

      const result = await client.branchExists('feature/nonexistent');

      expect(result).toBe(false);
    });

    it('should throw error for non-404 errors', async () => {
      const error = new Error('API error');
      (error as any).statusCode = 500;
      mockGet.mockRejectedValue(error);

      await expect(client.branchExists('feature/test')).rejects.toThrow();
    });
  });

  describe('Client Configuration', () => {
    it('should set correct base URL', () => {
      const client = new GitHubClient({
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect((client as any).baseURL || (client as any).config?.baseURL).toContain(
        'api.github.com'
      );
    });

    it('should include authorization header', () => {
      const client = new GitHubClient({
        token: 'test-token-123',
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const headers = (client as any).headers || (client as any).config?.headers;
      expect(headers?.Authorization).toBe('Bearer test-token-123');
      expect(headers?.Accept).toContain('application/vnd.github');
    });

    it('should include GitHub API version header', () => {
      const client = new GitHubClient({
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      });

      const headers = (client as any).headers || (client as any).config?.headers;
      expect(headers?.['X-GitHub-Api-Version']).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const client = new GitHubClient({
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        timeout: 10000,
      });

      const timeout = (client as any).timeout || (client as any).config?.timeout;
      expect(timeout).toBe(10000);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNREFUSED';
      mockGet.mockRejectedValue(networkError);

      await expect(client.branchExists('test')).rejects.toThrow();
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).statusCode = 429;
      (rateLimitError as any).response = { status: 429 };
      mockGet.mockRejectedValue(rateLimitError);

      await expect(client.branchExists('test')).rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Bad credentials');
      (authError as any).statusCode = 401;
      mockGet.mockRejectedValue(authError);

      await expect(client.branchExists('test')).rejects.toThrow();
    });

    it('should handle permission errors', async () => {
      const permError = new Error('Forbidden');
      (permError as any).statusCode = 403;
      mockPost.mockRejectedValue(permError);

      await expect(client.createPR('Test', 'Body', 'branch')).rejects.toThrow(GitHubAPIError);
    });
  });
});
