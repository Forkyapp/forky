// Mock tsconfig-paths/register before any imports
jest.mock('tsconfig-paths/register', () => ({}));

// Mock environment variables before any imports
// These will persist because we mock dotenv.config() below
const TEST_ENV = {
  CLICKUP_API_KEY: 'test-api-key',
  CLICKUP_BOT_USER_ID: '12345',
  CLICKUP_WORKSPACE_ID: '90181842045',
  GITHUB_REPO_PATH: '/test/repo/path',
  GITHUB_OWNER: 'test-owner',
  GITHUB_REPO: 'test-repo',
  GITHUB_TOKEN: 'test-github-token',
  POLL_INTERVAL_MS: '15000'
};

// Set them multiple times to ensure they stick
Object.assign(process.env, TEST_ENV);

// Mock all external dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('dotenv', () => ({
  config: jest.fn()
}));
jest.mock('child_process', () => ({
  exec: jest.fn(),
  promisify: jest.fn(() => jest.fn())
}));
jest.mock('./src/core/discord/discord.service', () => ({
  discordService: {
    initialize: jest.fn(),
    processNewMessages: jest.fn(),
    isInitialized: false
  }
}));

import * as fs from 'fs';
import axios from 'axios';
import config from './src/shared/config';
import { cache, queue, tracking } from './lib/storage';
import { getAssignedTasks, updateStatus, addComment, parseCommand, detectRepository } from './lib/clickup';
import { ensureClaudeSettings } from './src/core/ai-services/claude.service';
import { pollAndProcess } from './timmy';

// Restore environment variables after config module deletes them
Object.assign(process.env, TEST_ENV);
// Also update the config object directly
config.clickup.apiKey = TEST_ENV.CLICKUP_API_KEY;
config.clickup.botUserId = parseInt(TEST_ENV.CLICKUP_BOT_USER_ID);
config.clickup.workspaceId = TEST_ENV.CLICKUP_WORKSPACE_ID;
config.github.repoPath = TEST_ENV.GITHUB_REPO_PATH;
config.github.owner = TEST_ENV.GITHUB_OWNER;
config.github.repo = TEST_ENV.GITHUB_REPO;
config.github.token = TEST_ENV.GITHUB_TOKEN;

// Mock fs module with proper types
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock axios with proper types
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Forky Task Automation System', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock return values
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockReturnValue('[]');
    mockedFs.writeFileSync.mockReturnValue(undefined);
    mockedFs.mkdirSync.mockReturnValue(undefined);
    mockedFs.chmodSync.mockReturnValue(undefined);
    mockedFs.unlinkSync.mockReturnValue(undefined);
    mockedAxios.get.mockResolvedValue({ data: { tasks: [] } } as any);
    mockedAxios.post.mockResolvedValue({} as any);
    mockedAxios.put.mockResolvedValue({} as any);
  });

  describe('Cache Management', () => {
    describe('load', () => {
      it('should return empty array when cache file does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);

        const result = cache.load();

        expect(result).toEqual([]);
      });

      it('should load tasks from cache file when it exists', () => {
        const mockTasks = [
          { id: '1', title: 'Task 1', description: 'Desc 1', detectedAt: '2024-01-01' },
          { id: '2', title: 'Task 2', description: 'Desc 2', detectedAt: '2024-01-02' }
        ];

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockTasks));

        const result = cache.load();

        expect(result).toEqual(mockTasks);
      });

      it('should convert old format (array of IDs) to new format', () => {
        const oldFormat = ['task-1', 'task-2', 'task-3'];

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(oldFormat));

        const result = cache.load();

        expect(result).toHaveLength(3);
        expect(result[0]).toHaveProperty('id', 'task-1');
        expect(result[0]).toHaveProperty('title', 'Unknown');
      });

      it('should handle errors gracefully', () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockImplementation(() => {
          throw new Error('Read error');
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const result = cache.load();

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('save', () => {
      it('should write tasks to cache file', () => {
        cache.save();

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
      });

      it('should handle write errors gracefully', () => {
        mockedFs.writeFileSync.mockImplementation(() => {
          throw new Error('Write error');
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        cache.save();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('add', () => {
      beforeEach(() => {
        // Initialize cache with empty data
        mockedFs.existsSync.mockReturnValue(false);
        cache.init();
      });

      it('should add task to processed list', () => {
        const task = {
          id: 'task-123',
          name: 'Test Task',
          description: 'Test Description'
        };

        cache.add(task);

        expect(cache.has('task-123')).toBe(true);
        const data = cache.getData();
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe('task-123');
        expect(data[0].title).toBe('Test Task');
      });

      it('should not add duplicate tasks', () => {
        const task = {
          id: 'task-123',
          name: 'Test Task'
        };

        cache.add(task);
        cache.add(task); // Try to add again

        expect(cache.getData()).toHaveLength(1);
      });
    });

    describe('has', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockReturnValue(false);
        cache.init();
      });

      it('should return true for cached task', () => {
        const task = { id: 'task-123', name: 'Test Task' };
        cache.add(task);

        expect(cache.has('task-123')).toBe(true);
      });

      it('should return false for non-cached task', () => {
        expect(cache.has('task-999')).toBe(false);
      });
    });
  });

  describe('ClickUp API', () => {
    describe('getAssignedTasks', () => {
      it('should fetch specific task by ID', async () => {
        const mockTask = {
          id: '869ajuxp3',
          name: 'Test Task',
          status: { status: 'bot in progress' }
        };

        mockedAxios.get.mockResolvedValue({ data: { tasks: [mockTask] } } as any);

        const result = await getAssignedTasks();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('869ajuxp3');
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('api.clickup.com'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'test-api-key'
            })
          })
        );
      });

      it('should return empty array on API error', async () => {
        mockedAxios.get.mockRejectedValue(new Error('API Error'));

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const result = await getAssignedTasks();

        expect(result).toEqual([]);
        consoleSpy.mockRestore();
      });
    });

    describe('updateStatus', () => {
      it('should update task status via API', async () => {
        mockedAxios.put.mockResolvedValue({} as any);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await updateStatus('task-123', 'completed');

        expect(mockedAxios.put).toHaveBeenCalledWith(
          'https://api.clickup.com/api/v2/task/task-123',
          { status: 'completed' },
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'test-api-key'
            })
          })
        );
        consoleSpy.mockRestore();
      });

      it('should handle API errors gracefully', async () => {
        mockedAxios.put.mockRejectedValue(new Error('Update failed'));

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await updateStatus('task-123', 'completed');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('addComment', () => {
      it('should add comment to task', async () => {
        mockedAxios.post.mockResolvedValue({} as any);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await addComment('task-123', 'Test comment');

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://api.clickup.com/api/v2/task/task-123/comment',
          { comment_text: 'Test comment' },
          expect.any(Object)
        );
        consoleSpy.mockRestore();
      });

      it('should skip comment when disabled', async () => {
        process.env.DISABLE_COMMENTS = 'true';

        const result = await addComment('task-123', 'Test comment');

        expect(result.disabled).toBe(true);
        expect(mockedAxios.post).not.toHaveBeenCalled();

        delete process.env.DISABLE_COMMENTS;
      });
    });

    describe('parseCommand', () => {
      it('should parse rerun check command', () => {
        expect(parseCommand('re-run check')).toEqual({ type: 'rerun-codex-review' });
        expect(parseCommand('rerun check')).toEqual({ type: 'rerun-codex-review' });
      });

      it('should parse rerun fixes command', () => {
        expect(parseCommand('re-run fixes')).toEqual({ type: 'rerun-claude-fixes' });
        expect(parseCommand('rerun fixes')).toEqual({ type: 'rerun-claude-fixes' });
      });

      it('should return null for invalid commands', () => {
        expect(parseCommand('invalid command')).toBeNull();
        expect(parseCommand('')).toBeNull();
        expect(parseCommand(null)).toBeNull();
      });
    });

    describe('detectRepository', () => {
      it('should detect repository from custom fields', () => {
        const task = {
          id: '1',
          name: 'Test',
          custom_fields: [
            { name: 'Repository', value: 'my-repo' }
          ]
        };

        expect(detectRepository(task)).toBe('my-repo');
      });

      it('should detect repository from tags', () => {
        const task = {
          id: '1',
          name: 'Test',
          tags: [
            { name: 'repo:other-repo' }
          ]
        };

        expect(detectRepository(task)).toBe('other-repo');
      });

      it('should detect repository from description', () => {
        const task = {
          id: '1',
          name: 'Test',
          description: '[Repository: desc-repo] Some task'
        };

        expect(detectRepository(task)).toBe('desc-repo');
      });

      it('should return null when no repository specified', () => {
        const task = {
          id: '1',
          name: 'Test'
        };

        expect(detectRepository(task)).toBeNull();
      });
    });
  });

  describe('Queue Management', () => {
    describe('load', () => {
      it('should return default queue when file does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);

        const result = queue.load();

        expect(result).toEqual({ pending: [], completed: [] });
      });

      it('should load queue from file when it exists', () => {
        const mockQueue = {
          pending: [{ id: '1', title: 'Task 1', description: '', branch: '', commitMessage: '', prTitle: '', prBody: '', queuedAt: '' }],
          completed: [{ id: '2', title: 'Task 2', description: '', branch: '', commitMessage: '', prTitle: '', prBody: '', queuedAt: '' }]
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockQueue));

        const result = queue.load();

        expect(result).toEqual(mockQueue);
      });
    });

    describe('add', () => {
      it('should add task to pending queue', async () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockReturnValue(undefined);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const mockTask = {
          id: 'task-123',
          name: 'Test Task',
          description: 'Test Description',
          url: 'https://app.clickup.com/t/task-123'
        };

        const result = await queue.add(mockTask);

        expect(result).toEqual({ success: true });
        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should detect already queued tasks', async () => {
        const existingQueue = {
          pending: [{
            id: 'task-123',
            title: 'Existing',
            description: '',
            branch: '',
            commitMessage: '',
            prTitle: '',
            prBody: '',
            queuedAt: ''
          }],
          completed: []
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingQueue));
        mockedFs.writeFileSync.mockReturnValue(undefined);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const mockTask = {
          id: 'task-123',
          name: 'Test Task'
        };

        const result = await queue.add(mockTask);

        expect(result).toEqual({ alreadyQueued: true });
        consoleSpy.mockRestore();
      });
    });
  });

  describe('PR Tracking System', () => {
    describe('load', () => {
      it('should return empty array when file does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);

        const result = tracking.load();

        expect(result).toEqual([]);
      });

      it('should load tracking data from file', () => {
        const mockTracking = [
          { taskId: '1', taskName: 'Task 1', branch: 'task-1', startedAt: '2024-01-01', owner: 'test-owner', repo: 'test-repo' }
        ];

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockTracking));

        const result = tracking.load();

        expect(result).toEqual(mockTracking);
      });
    });

    describe('start', () => {
      it('should start tracking for a task', () => {
        mockedFs.writeFileSync.mockReturnValue(undefined);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const task = {
          id: 'task-123',
          name: 'Test Task'
        };

        tracking.start(task);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Claude Code Automation', () => {
    describe('ensureClaudeSettings', () => {
      it('should create .claude directory if it does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.mkdirSync.mockReturnValue(undefined);
        mockedFs.writeFileSync.mockReturnValue(undefined);

        ensureClaudeSettings('/test/repo/path');

        expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('.claude'),
          { recursive: true }
        );
      });

      it('should write settings.json with full permissions', () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.writeFileSync.mockReturnValue(undefined);

        ensureClaudeSettings('/test/repo/path');

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining('settings.json'),
          expect.stringContaining('"permissions"')
        );
      });

      it('should not create directory if it already exists', () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.mkdirSync.mockReturnValue(undefined);
        mockedFs.writeFileSync.mockReturnValue(undefined);

        ensureClaudeSettings('/test/repo/path');

        expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
      });
    });
  });

  describe('Integration Tests', () => {
    describe('pollAndProcess', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockReturnValue(false);
        cache.init();
      });

      it('should skip already processed tasks', async () => {
        const mockTask = {
          id: 'task-1',
          name: 'Task 1',
          status: { status: 'bot in progress' }
        };

        mockedAxios.get.mockResolvedValue({ data: { tasks: [mockTask] } } as any);

        // Simulate task already processed
        cache.add({ id: 'task-1', name: 'Task 1' });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await pollAndProcess();

        // Task should be silently skipped (no processing happens)
        // Verify that task is still in cache
        expect(cache.has('task-1')).toBe(true);

        consoleSpy.mockRestore();
      });

      it('should handle polling errors gracefully', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network error'));

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        await pollAndProcess();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });
});
