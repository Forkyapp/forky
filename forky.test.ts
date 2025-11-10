// Mock environment variables before any imports
process.env.CLICKUP_API_KEY = 'test-api-key';
process.env.CLICKUP_BOT_USER_ID = '12345';
process.env.CLICKUP_WORKSPACE_ID = '90181842045';
process.env.GITHUB_REPO_PATH = '/test/repo/path';
process.env.GITHUB_OWNER = 'test-owner';
process.env.GITHUB_REPO = 'test-repo';
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.POLL_INTERVAL_MS = '15000';

// Mock all external dependencies
jest.mock('fs');
jest.mock('axios');
jest.mock('child_process', () => ({
  exec: jest.fn(),
  promisify: jest.fn(() => jest.fn())
}));

import * as fs from 'fs';
import axios from 'axios';

// Type definitions for the module being tested
interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  text_content?: string;
  url?: string;
  status?: {
    status: string;
  };
}

interface ProcessedTask {
  id: string;
  title: string;
  description: string;
  detectedAt: string;
}

interface QueueData {
  pending: QueuedTask[];
  completed: QueuedTask[];
}

interface QueuedTask {
  id: string;
  title: string;
  description?: string;
  url?: string;
  queuedAt?: string;
}

interface TrackingEntry {
  taskId: string;
  taskName?: string;
  branch: string;
  startedAt?: string;
  owner: string;
  repo: string;
}

interface PRCheckResult {
  found: boolean;
  url?: string;
  number?: number;
  state?: string;
}

interface QueueResult {
  success?: boolean;
  alreadyQueued?: boolean;
}

// Mock fs module with proper types
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock axios with proper types
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Don't actually run the startup code
// Note: When forky.js is required in tests, require.main !== module,
// so the startup code won't run automatically

// Load the module once with mocks in place
// Note: This test file may be for an older version of the module
// The actual exports from forky.js are: pollAndProcess, gracefulShutdown,
// load, save, add, getPending, getCompleted, getAssignedTasks, updateStatus,
// addComment, getTaskComments, parseCommand, detectRepository,
// ensureClaudeSettings, launchClaude, fixTodoComments, config
const forky = require('./forky.js') as {
  CACHE_FILE?: string;
  QUEUE_FILE?: string;
  processedTasksData?: ProcessedTask[];
  processedTaskIds?: Set<string>;
  prTracking?: TrackingEntry[];
  loadProcessedTasks?: () => ProcessedTask[];
  saveProcessedTasks?: () => void;
  addToProcessed?: (task: ClickUpTask) => void;
  getAssignedTasks: () => Promise<ClickUpTask[]>;
  updateTaskStatus?: (taskId: string, status: string) => Promise<void>;
  updateStatus?: (taskId: string, status: string) => Promise<void>;
  addClickUpComment?: (taskId: string, comment: string) => Promise<void>;
  addComment?: (taskId: string, comment: string) => Promise<void>;
  loadQueue?: () => QueueData;
  saveQueue?: (queue: QueueData) => void;
  queueTask?: (task: ClickUpTask) => Promise<QueueResult>;
  loadPRTracking?: () => TrackingEntry[];
  checkForPR?: (tracking: TrackingEntry) => Promise<PRCheckResult>;
  ensureClaudeSettings: () => void;
  pollAndProcess: () => Promise<void>;
  gracefulShutdown?: () => void;
  config?: any;
};

describe('Forky Task Automation System', () => {
  beforeEach(() => {
    // Just clear mock call history, don't reload the module
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

    // Reset state for tests
    forky.processedTasksData = [];
    forky.processedTaskIds = new Set<string>();
    forky.prTracking = [];
  });

  describe('Cache Management', () => {
    describe('loadProcessedTasks', () => {
      it('should return empty array when cache file does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);

        const result: ProcessedTask[] | undefined = forky.loadProcessedTasks?.();

        expect(result).toEqual([]);
      });

      it('should load tasks from cache file when it exists', () => {
        const mockTasks: ProcessedTask[] = [
          { id: '1', title: 'Task 1', description: 'Desc 1', detectedAt: '2024-01-01' },
          { id: '2', title: 'Task 2', description: 'Desc 2', detectedAt: '2024-01-02' }
        ];

        // Temporarily override the mock for this test
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockTasks));

        const result: ProcessedTask[] | undefined = forky.loadProcessedTasks?.();

        expect(result).toEqual(mockTasks);
        expect(mockedFs.readFileSync).toHaveBeenCalledWith(forky.CACHE_FILE, 'utf8');
      });

      it('should convert old format (array of IDs) to new format', () => {
        const oldFormat: string[] = ['task-1', 'task-2', 'task-3'];

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(oldFormat));

        const result: ProcessedTask[] | undefined = forky.loadProcessedTasks?.();

        expect(result).toHaveLength(3);
        expect(result?.[0]).toHaveProperty('id', 'task-1');
        expect(result?.[0]).toHaveProperty('title', 'Unknown');
      });

      it('should handle errors gracefully', () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockImplementation(() => {
          throw new Error('Read error');
        });

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation();
        const result: ProcessedTask[] | undefined = forky.loadProcessedTasks?.();

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('saveProcessedTasks', () => {
      it('should write tasks to cache file', () => {
        forky.saveProcessedTasks?.();

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
          forky.CACHE_FILE,
          expect.any(String)
        );
      });

      it('should handle write errors gracefully', () => {
        mockedFs.writeFileSync.mockImplementation(() => {
          throw new Error('Write error');
        });

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation();
        forky.saveProcessedTasks?.();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('addToProcessed', () => {
      it('should add task to processed list', () => {
        const task: ClickUpTask = {
          id: 'task-123',
          name: 'Test Task',
          description: 'Test Description'
        };

        forky.addToProcessed?.(task);

        const taskData: ProcessedTask[] | undefined = forky.processedTasksData;
        expect(taskData).toHaveLength(1);
        expect(taskData?.[0].id).toBe('task-123');
        expect(taskData?.[0].title).toBe('Test Task');
        expect(forky.processedTaskIds?.has('task-123')).toBe(true);
      });

      it('should not add duplicate tasks', () => {
        const task: ClickUpTask = {
          id: 'task-123',
          name: 'Test Task'
        };

        forky.addToProcessed?.(task);
        forky.addToProcessed?.(task); // Try to add again

        expect(forky.processedTasksData).toHaveLength(1);
      });
    });
  });

  describe('ClickUp API', () => {
    describe('getAssignedTasks', () => {
      it('should fetch and filter tasks with bot in progress status', async () => {
        const mockResponse = {
          data: {
            tasks: [
              { id: '1', name: 'Task 1', status: { status: 'bot in progress' } },
              { id: '2', name: 'Task 2', status: { status: 'in progress' } },
              { id: '3', name: 'Task 3', status: { status: 'bot in progress' } }
            ]
          }
        };

        mockedAxios.get.mockResolvedValue(mockResponse as any);

        const result: ClickUpTask[] = await forky.getAssignedTasks();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('1');
        expect(result[1].id).toBe('3');
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

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();
        const result: ClickUpTask[] = await forky.getAssignedTasks();

        expect(result).toEqual([]);
        consoleSpy.mockRestore();
      });
    });

    describe('updateTaskStatus', () => {
      it('should update task status via API', async () => {
        mockedAxios.put.mockResolvedValue({} as any);

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();
        await forky.updateTaskStatus?.('task-123', 'completed');

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

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();
        await forky.updateTaskStatus?.('task-123', 'completed');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('addClickUpComment', () => {
      it('should add comment to task', async () => {
        mockedAxios.post.mockResolvedValue({} as any);

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();
        await forky.addClickUpComment?.('task-123', 'Test comment');

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://api.clickup.com/api/v2/task/task-123/comment',
          { comment_text: 'Test comment' },
          expect.any(Object)
        );
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Queue Management', () => {
    describe('loadQueue', () => {
      it('should return default queue when file does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);

        const result: QueueData | undefined = forky.loadQueue?.();

        expect(result).toEqual({ pending: [], completed: [] });
      });

      it('should load queue from file when it exists', () => {
        const mockQueue: QueueData = {
          pending: [{ id: '1', title: 'Task 1' }],
          completed: [{ id: '2', title: 'Task 2' }]
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockQueue));

        const result: QueueData | undefined = forky.loadQueue?.();

        expect(result).toEqual(mockQueue);
      });
    });

    describe('saveQueue', () => {
      it('should save queue to file', () => {
        const mockQueue: QueueData = { pending: [], completed: [] };

        forky.saveQueue?.(mockQueue);

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
          forky.QUEUE_FILE,
          expect.any(String)
        );
      });
    });

    describe('queueTask', () => {
      it('should add task to pending queue', async () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockReturnValue(undefined);

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();

        const mockTask: ClickUpTask = {
          id: 'task-123',
          name: 'Test Task',
          description: 'Test Description',
          url: 'https://app.clickup.com/t/task-123'
        };

        const result: QueueResult | undefined = await forky.queueTask?.(mockTask);

        expect(result).toEqual({ success: true });
        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should detect already queued tasks', async () => {
        const existingQueue: QueueData = {
          pending: [{ id: 'task-123', title: 'Existing' }],
          completed: []
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingQueue));
        mockedFs.writeFileSync.mockReturnValue(undefined);

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();

        const mockTask: ClickUpTask = {
          id: 'task-123',
          name: 'Test Task'
        };

        const result: QueueResult | undefined = await forky.queueTask?.(mockTask);

        expect(result).toEqual({ alreadyQueued: true });
        consoleSpy.mockRestore();
      });
    });
  });

  describe('PR Tracking System', () => {
    describe('loadPRTracking', () => {
      it('should return empty array when file does not exist', () => {
        mockedFs.existsSync.mockReturnValue(false);

        const result: TrackingEntry[] | undefined = forky.loadPRTracking?.();

        expect(result).toEqual([]);
      });

      it('should load tracking data from file', () => {
        const mockTracking: TrackingEntry[] = [
          { taskId: '1', branch: 'task-1', startedAt: '2024-01-01', owner: 'test-owner', repo: 'test-repo' }
        ];

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockTracking));

        const result: TrackingEntry[] | undefined = forky.loadPRTracking?.();

        expect(result).toEqual(mockTracking);
      });
    });

    describe('checkForPR', () => {
      it('should find PR when it exists', async () => {
        const mockTracking: TrackingEntry = {
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'task-123',
          taskId: 'task-123'
        };

        const mockPR = {
          html_url: 'https://github.com/test-owner/test-repo/pull/1',
          number: 1,
          state: 'open'
        };

        mockedAxios.get.mockResolvedValue({ data: [mockPR] } as any);

        const result: PRCheckResult | undefined = await forky.checkForPR?.(mockTracking);

        expect(result).toEqual({
          found: true,
          url: mockPR.html_url,
          number: mockPR.number,
          state: mockPR.state
        });
      });

      it('should return not found when PR does not exist', async () => {
        const mockTracking: TrackingEntry = {
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'task-123',
          taskId: 'task-123'
        };

        mockedAxios.get.mockResolvedValue({ data: [] } as any);

        const result: PRCheckResult | undefined = await forky.checkForPR?.(mockTracking);

        expect(result).toEqual({ found: false });
      });

      it('should handle API errors', async () => {
        const mockTracking: TrackingEntry = {
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'task-123',
          taskId: 'task-123'
        };

        mockedAxios.get.mockRejectedValue(new Error('GitHub API Error'));

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'error').mockImplementation();
        const result: PRCheckResult | undefined = await forky.checkForPR?.(mockTracking);

        expect(result).toEqual({ found: false });
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

        forky.ensureClaudeSettings();

        expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('.claude'),
          { recursive: true }
        );
      });

      it('should write settings.json with full permissions', () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.writeFileSync.mockReturnValue(undefined);

        forky.ensureClaudeSettings();

        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining('settings.json'),
          expect.stringContaining('"permissions"')
        );
      });

      it('should not create directory if it already exists', () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.mkdirSync.mockReturnValue(undefined);
        mockedFs.writeFileSync.mockReturnValue(undefined);

        forky.ensureClaudeSettings();

        expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
      });
    });
  });

  describe('Integration Tests', () => {
    describe('pollAndProcess', () => {
      it('should skip already processed tasks', async () => {
        const mockTasks: ClickUpTask[] = [
          { id: 'task-1', name: 'Task 1', status: { status: 'bot in progress' } }
        ];

        mockedAxios.get.mockResolvedValue({ data: { tasks: mockTasks } } as any);

        // Simulate task already processed
        forky.processedTaskIds.add('task-1');

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();
        await forky.pollAndProcess();

        // Should not log "TARGET ACQUIRED" since task is already processed
        const logs: string = consoleSpy.mock.calls.flat().join(' ');
        expect(logs).not.toContain('TARGET ACQUIRED');

        consoleSpy.mockRestore();
      });

      it('should handle polling errors gracefully', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network error'));

        const consoleSpy: jest.SpyInstance = jest.spyOn(console, 'log').mockImplementation();
        await forky.pollAndProcess();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });
});
