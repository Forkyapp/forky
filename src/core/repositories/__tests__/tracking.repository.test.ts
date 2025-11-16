/**
 * Tracking Repository Tests
 * Tests PR tracking, review cycle tracking, and processed comments tracking
 */

import fs from 'fs';
import {
  PRTrackingRepository,
  ReviewTrackingRepository,
  ProcessedCommentsRepository,
} from '../tracking.repository';
import { FileReadError, FileWriteError } from '@/shared/errors';
import { createTempDir, cleanupTempDir } from '../../../test-setup';
import type { ClickUpTaskData, GitHubPRFoundInfo, TrackingEntry, ReviewEntry } from '@/types';

describe('PR Tracking Repository', () => {
  let tempDir: string;
  let filePath: string;
  let repo: PRTrackingRepository;

  beforeEach(() => {
    tempDir = createTempDir('pr-tracking-test');
    filePath = `${tempDir}/pr-tracking.json`;
    repo = new PRTrackingRepository(filePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty array when file does not exist', async () => {
      const result = await repo.load();
      expect(result).toEqual([]);
    });

    it('should load existing tracking data', async () => {
      const testData: TrackingEntry[] = [
        {
          taskId: 'task-123',
          taskName: 'Test task',
          branch: 'task-task-123',
          startedAt: '2025-01-01T00:00:00Z',
          owner: 'test-owner',
          repo: 'test-repo',
        },
      ];

      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await repo.load();
      expect(result).toEqual(testData);
    });

    it('should throw FileReadError on corrupted JSON', async () => {
      fs.writeFileSync(filePath, 'invalid json');

      await expect(repo.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save tracking data to file', async () => {
      const testData: TrackingEntry[] = [
        {
          taskId: 'task-123',
          taskName: 'Test task',
          branch: 'task-task-123',
          startedAt: '2025-01-01T00:00:00Z',
        },
      ];

      await repo.save(testData);

      const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(savedData).toEqual(testData);
    });

    it('should throw FileWriteError on write failure', async () => {
      const invalidRepo = new PRTrackingRepository('/nonexistent/directory/file.json');

      await expect(invalidRepo.save([])).rejects.toThrow(FileWriteError);
    });
  });

  describe('start', () => {
    it('should start tracking for a task', async () => {
      await repo.init();

      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
        name: 'Add login feature',
      };
      const config = {
        owner: 'test-owner',
        repo: 'test-repo',
      };

      await repo.start(task, config);

      const entries = await repo.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].taskId).toBe('task-123');
      expect(entries[0].taskName).toBe('Add login feature');
      expect(entries[0].branch).toBe('task-task-123');
      expect(entries[0].owner).toBe('test-owner');
      expect(entries[0].repo).toBe('test-repo');
      expect(entries[0].startedAt).toBeDefined();
    });

    it('should use title if name is not provided', async () => {
      await repo.init();

      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
        title: 'Login Feature',
      };

      await repo.start(task, {});

      const entries = await repo.getAll();
      expect(entries[0].taskName).toBe('Login Feature');
    });

    it('should handle task without name or title', async () => {
      await repo.init();

      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
      };

      await repo.start(task, {});

      const entries = await repo.getAll();
      expect(entries[0].taskName).toBe('');
    });

    it('should persist tracking entry to file', async () => {
      await repo.init();

      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
        name: 'Test',
      };

      await repo.start(task, {});

      // Create new repo instance to verify persistence
      const newRepo = new PRTrackingRepository(filePath);
      await newRepo.init();
      const entries = await newRepo.getAll();

      expect(entries).toHaveLength(1);
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      await repo.init();
      await repo.start({ id: 'task-1', name: 'Task 1' }, {});
      await repo.start({ id: 'task-2', name: 'Task 2' }, {});
      await repo.start({ id: 'task-3', name: 'Task 3' }, {});
    });

    it('should remove tracking entry by task ID', async () => {
      await repo.remove('task-2');

      const entries = await repo.getAll();
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.taskId === 'task-2')).toBeUndefined();
    });

    it('should handle removing non-existent task', async () => {
      await repo.remove('non-existent');

      const entries = await repo.getAll();
      expect(entries).toHaveLength(3);
    });

    it('should persist changes after removal', async () => {
      await repo.remove('task-1');

      const newRepo = new PRTrackingRepository(filePath);
      await newRepo.init();
      const entries = await newRepo.getAll();

      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.taskId === 'task-1')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array for empty tracking', async () => {
      await repo.init();

      const entries = await repo.getAll();
      expect(entries).toEqual([]);
    });

    it('should return copy of data array', async () => {
      await repo.init();
      await repo.start({ id: 'task-1', name: 'Task 1' }, {});

      const entries = await repo.getAll();
      entries.push({
        taskId: 'task-2',
        taskName: 'Task 2',
        branch: 'branch',
        startedAt: '2025-01-01T00:00:00Z',
      });

      const entriesAgain = await repo.getAll();
      expect(entriesAgain).toHaveLength(1);
    });
  });

  describe('init', () => {
    it('should initialize and load existing data', async () => {
      const testData: TrackingEntry[] = [
        {
          taskId: 'task-123',
          taskName: 'Test task',
          branch: 'task-task-123',
          startedAt: '2025-01-01T00:00:00Z',
        },
      ];

      fs.writeFileSync(filePath, JSON.stringify(testData));

      await repo.init();
      const entries = await repo.getAll();

      expect(entries).toEqual(testData);
    });
  });
});

describe('Review Tracking Repository', () => {
  let tempDir: string;
  let filePath: string;
  let repo: ReviewTrackingRepository;

  beforeEach(() => {
    tempDir = createTempDir('review-tracking-test');
    filePath = `${tempDir}/review-tracking.json`;
    repo = new ReviewTrackingRepository(filePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load and save', () => {
    it('should return empty array when file does not exist', async () => {
      const result = await repo.load();
      expect(result).toEqual([]);
    });

    it('should load and save review entries', async () => {
      const testData: ReviewEntry[] = [
        {
          taskId: 'task-123',
          taskName: 'Test task',
          branch: 'feature/task-123',
          prNumber: 42,
          prUrl: 'https://github.com/owner/repo/pull/42',
          stage: 'waiting_for_codex_review',
          iteration: 0,
          maxIterations: 3,
          startedAt: '2025-01-01T00:00:00Z',
          lastCommitSha: null,
        },
      ];

      await repo.save(testData);

      const result = await repo.load();
      expect(result).toEqual(testData);
    });
  });

  describe('startReviewCycle', () => {
    beforeEach(async () => {
      await repo.init();
    });

    it('should start new review cycle', async () => {
      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
        name: 'Add login feature',
      };
      const prInfo: Partial<GitHubPRFoundInfo> = {
        branch: 'feature/task-123',
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
      };
      const repoConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        repoPath: '/test/path',
        repository: 'test-owner/test-repo',
      };

      const result = await repo.startReviewCycle(task, prInfo, repoConfig);

      expect(result).toBe(true);

      const entry = await repo.get('task-123');
      expect(entry).toBeDefined();
      expect(entry?.taskId).toBe('task-123');
      expect(entry?.taskName).toBe('Add login feature');
      expect(entry?.branch).toBe('feature/task-123');
      expect(entry?.prNumber).toBe(42);
      expect(entry?.prUrl).toBe('https://github.com/owner/repo/pull/42');
      expect(entry?.stage).toBe('waiting_for_codex_review');
      expect(entry?.iteration).toBe(0);
      expect(entry?.maxIterations).toBe(3);
      expect(entry?.lastCommitSha).toBeNull();
      expect(entry?.owner).toBe('test-owner');
      expect(entry?.repo).toBe('test-repo');
      expect(entry?.repoPath).toBe('/test/path');
    });

    it('should return false if review cycle already exists', async () => {
      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
        name: 'Test',
      };

      await repo.startReviewCycle(task, {}, {});
      const result = await repo.startReviewCycle(task, {}, {});

      expect(result).toBe(false);

      const entries = await repo.getAll();
      expect(entries).toHaveLength(1);
    });

    it('should use default branch if not provided', async () => {
      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
        name: 'Test',
      };

      await repo.startReviewCycle(task, {}, {});

      const entry = await repo.get('task-123');
      expect(entry?.branch).toBe('task-task-123');
    });

    it('should handle missing PR info', async () => {
      const task: ClickUpTaskData = {
        name: 'Test Task',
        id: 'task-123',
        name: 'Test',
      };

      await repo.startReviewCycle(task, {}, {});

      const entry = await repo.get('task-123');
      expect(entry?.prNumber).toBe(0);
      expect(entry?.prUrl).toBe('');
    });
  });

  describe('updateStage', () => {
    beforeEach(async () => {
      await repo.init();
      await repo.startReviewCycle(
        { id: 'task-123', name: 'Test' },
        {},
        {}
      );
    });

    it('should update stage for existing entry', async () => {
      await repo.updateStage('task-123', 'codex_review_complete');

      const entry = await repo.get('task-123');
      expect(entry?.stage).toBe('codex_review_complete');
    });

    it('should persist stage update', async () => {
      await repo.updateStage('task-123', 'codex_review_complete');

      const newRepo = new ReviewTrackingRepository(filePath);
      await newRepo.init();
      const entry = await newRepo.get('task-123');

      expect(entry?.stage).toBe('codex_review_complete');
    });

    it('should handle updating non-existent entry', async () => {
      await repo.updateStage('non-existent', 'new_stage');

      const entry = await repo.get('non-existent');
      expect(entry).toBeNull();
    });
  });

  describe('updateIteration', () => {
    beforeEach(async () => {
      await repo.init();
      await repo.startReviewCycle(
        { id: 'task-123', name: 'Test' },
        {},
        {}
      );
    });

    it('should update iteration count', async () => {
      await repo.updateIteration('task-123', 2);

      const entry = await repo.get('task-123');
      expect(entry?.iteration).toBe(2);
    });

    it('should handle updating non-existent entry', async () => {
      await repo.updateIteration('non-existent', 5);

      const entry = await repo.get('non-existent');
      expect(entry).toBeNull();
    });
  });

  describe('updateCommitSha', () => {
    beforeEach(async () => {
      await repo.init();
      await repo.startReviewCycle(
        { id: 'task-123', name: 'Test' },
        {},
        {}
      );
    });

    it('should update last commit SHA', async () => {
      await repo.updateCommitSha('task-123', 'abc123def456');

      const entry = await repo.get('task-123');
      expect(entry?.lastCommitSha).toBe('abc123def456');
    });

    it('should handle updating non-existent entry', async () => {
      await repo.updateCommitSha('non-existent', 'sha');

      const entry = await repo.get('non-existent');
      expect(entry).toBeNull();
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      await repo.init();
      await repo.startReviewCycle({ id: 'task-1', name: 'Task 1' }, {}, {});
      await repo.startReviewCycle({ id: 'task-2', name: 'Task 2' }, {}, {});
      await repo.startReviewCycle({ id: 'task-3', name: 'Task 3' }, {}, {});
    });

    it('should remove review entry by task ID', async () => {
      await repo.remove('task-2');

      const entry = await repo.get('task-2');
      expect(entry).toBeNull();

      const entries = await repo.getAll();
      expect(entries).toHaveLength(2);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await repo.init();
      await repo.startReviewCycle({ id: 'task-123', name: 'Test' }, {}, {});
    });

    it('should get entry by task ID', async () => {
      const entry = await repo.get('task-123');

      expect(entry).toBeDefined();
      expect(entry?.taskId).toBe('task-123');
    });

    it('should return null for non-existent task', async () => {
      const entry = await repo.get('non-existent');

      expect(entry).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return empty array for empty tracking', async () => {
      await repo.init();

      const entries = await repo.getAll();
      expect(entries).toEqual([]);
    });

    it('should return all entries', async () => {
      await repo.init();
      await repo.startReviewCycle({ id: 'task-1', name: 'Task 1' }, {}, {});
      await repo.startReviewCycle({ id: 'task-2', name: 'Task 2' }, {}, {});

      const entries = await repo.getAll();
      expect(entries).toHaveLength(2);
    });

    it('should return copy of data array', async () => {
      await repo.init();
      await repo.startReviewCycle({ id: 'task-1', name: 'Task 1' }, {}, {});

      const entries = await repo.getAll();
      entries[0].iteration = 999;

      const entry = await repo.get('task-1');
      expect(entry?.iteration).toBe(0);
    });
  });
});

describe('Processed Comments Repository', () => {
  let tempDir: string;
  let filePath: string;
  let repo: ProcessedCommentsRepository;

  beforeEach(() => {
    tempDir = createTempDir('comments-tracking-test');
    filePath = `${tempDir}/processed-comments.json`;
    repo = new ProcessedCommentsRepository(filePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty set when file does not exist', async () => {
      const result = await repo.load();
      expect(result).toEqual(new Set());
    });

    it('should load existing comment IDs', async () => {
      const testData = ['comment-1', 'comment-2', 'comment-3'];
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await repo.load();
      expect(result).toEqual(new Set(testData));
    });

    it('should throw FileReadError on corrupted JSON', async () => {
      fs.writeFileSync(filePath, 'invalid json');

      await expect(repo.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save comment IDs as array', async () => {
      const commentIds = new Set(['comment-1', 'comment-2']);

      await repo.save(commentIds);

      const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(savedData).toEqual(expect.arrayContaining(['comment-1', 'comment-2']));
      expect(savedData).toHaveLength(2);
    });

    it('should throw FileWriteError on write failure', async () => {
      const invalidRepo = new ProcessedCommentsRepository('/nonexistent/directory/file.json');

      await expect(invalidRepo.save(new Set())).rejects.toThrow(FileWriteError);
    });
  });

  describe('has', () => {
    beforeEach(async () => {
      await repo.init();
      await repo.add('comment-1');
      await repo.add('comment-2');
    });

    it('should return true for existing comment ID', async () => {
      const result = await repo.has('comment-1');
      expect(result).toBe(true);
    });

    it('should return false for non-existent comment ID', async () => {
      const result = await repo.has('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('add', () => {
    beforeEach(async () => {
      await repo.init();
    });

    it('should add comment ID to set', async () => {
      await repo.add('comment-1');

      const has = await repo.has('comment-1');
      expect(has).toBe(true);
    });

    it('should persist added comment ID', async () => {
      await repo.add('comment-1');

      const newRepo = new ProcessedCommentsRepository(filePath);
      await newRepo.init();
      const has = await newRepo.has('comment-1');

      expect(has).toBe(true);
    });

    it('should handle adding duplicate comment ID', async () => {
      await repo.add('comment-1');
      await repo.add('comment-1');

      const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(savedData).toHaveLength(1);
    });

    it('should add multiple comment IDs', async () => {
      await repo.add('comment-1');
      await repo.add('comment-2');
      await repo.add('comment-3');

      expect(await repo.has('comment-1')).toBe(true);
      expect(await repo.has('comment-2')).toBe(true);
      expect(await repo.has('comment-3')).toBe(true);
    });
  });

  describe('init', () => {
    it('should initialize and load existing data', async () => {
      const testData = ['comment-1', 'comment-2'];
      fs.writeFileSync(filePath, JSON.stringify(testData));

      await repo.init();

      expect(await repo.has('comment-1')).toBe(true);
      expect(await repo.has('comment-2')).toBe(true);
    });

    it('should initialize empty repository', async () => {
      await repo.init();

      expect(await repo.has('anything')).toBe(false);
    });
  });
});
