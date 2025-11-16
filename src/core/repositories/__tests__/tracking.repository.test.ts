/**
 * Tracking Repository Tests
 */

import fs from 'fs';
import {
  PRTrackingRepository,
  ReviewTrackingRepository,
  ProcessedCommentsRepository,
} from '../tracking.repository';
import { FileReadError, FileWriteError } from '../../../shared/errors';
import { createTempDir, cleanupTempDir } from '../../../test-setup';
import type { TrackingEntry, ReviewEntry, ClickUpTaskData } from '../../../types';

describe('PRTrackingRepository', () => {
  let tempDir: string;
  let trackingFilePath: string;
  let repository: PRTrackingRepository;

  beforeEach(() => {
    tempDir = createTempDir('pr-tracking-test');
    trackingFilePath = `${tempDir}/pr-tracking.json`;
    repository = new PRTrackingRepository(trackingFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty array when file does not exist', async () => {
      const entries = await repository.load();
      expect(entries).toEqual([]);
    });

    it('should load entries from file', async () => {
      const mockEntries: TrackingEntry[] = [
        {
          taskId: 'task-1',
          taskName: 'Test Task',
          branch: 'task-task-1',
          startedAt: '2024-01-01T00:00:00Z',
        },
      ];
      fs.writeFileSync(trackingFilePath, JSON.stringify(mockEntries));

      const entries = await repository.load();
      expect(entries).toEqual(mockEntries);
    });

    it('should throw FileReadError on invalid JSON', async () => {
      fs.writeFileSync(trackingFilePath, 'invalid json');

      await expect(repository.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save entries to file', async () => {
      const entries: TrackingEntry[] = [
        {
          taskId: 'task-1',
          taskName: 'Test Task',
          branch: 'task-task-1',
          startedAt: '2024-01-01T00:00:00Z',
        },
      ];

      await repository.save(entries);

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(entries);
    });

    it('should throw FileWriteError when file cannot be written', async () => {
      const invalidRepo = new PRTrackingRepository('/invalid/path/tracking.json');
      const entries: TrackingEntry[] = [];

      await expect(invalidRepo.save(entries)).rejects.toThrow(FileWriteError);
    });
  });

  describe('start', () => {
    it('should add tracking entry', async () => {
      const task: ClickUpTaskData = {
        id: 'task-1',
        name: 'Test Task',
      };
      const config = {
        owner: 'test-owner',
        repo: 'test-repo',
      };

      await repository.start(task, config);

      const entries = await repository.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].taskId).toBe('task-1');
      expect(entries[0].taskName).toBe('Test Task');
      expect(entries[0].branch).toBe('task-task-1');
      expect(entries[0].owner).toBe('test-owner');
      expect(entries[0].repo).toBe('test-repo');
      expect(entries[0].startedAt).toBeDefined();
    });

    it('should use title field if name not provided', async () => {
      const task: ClickUpTaskData = {
        id: 'task-1',
        name: 'Test Title',
      };

      await repository.start(task, {});

      const entries = await repository.getAll();
      expect(entries[0].taskName).toBe('Test Title');
    });

    it('should persist to file', async () => {
      const task: ClickUpTaskData = {
        id: 'task-1',
        name: 'Test Task',
      };

      await repository.start(task, {});

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].taskId).toBe('task-1');
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      const task1: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      const task2: ClickUpTaskData = { id: 'task-2', name: 'Task 2' };
      await repository.start(task1, {});
      await repository.start(task2, {});
    });

    it('should remove tracking entry', async () => {
      await repository.remove('task-1');

      const entries = await repository.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].taskId).toBe('task-2');
    });

    it('should persist changes to file', async () => {
      await repository.remove('task-1');

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toHaveLength(1);
    });

    it('should handle removing non-existent entry', async () => {
      await repository.remove('non-existent');

      const entries = await repository.getAll();
      expect(entries).toHaveLength(2);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no entries', async () => {
      const entries = await repository.getAll();
      expect(entries).toEqual([]);
    });

    it('should return all entries', async () => {
      const task1: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      const task2: ClickUpTaskData = { id: 'task-2', name: 'Task 2' };
      await repository.start(task1, {});
      await repository.start(task2, {});

      const entries = await repository.getAll();
      expect(entries).toHaveLength(2);
    });

    it('should return a copy of the array', async () => {
      const task: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      await repository.start(task, {});

      const entries1 = await repository.getAll();
      const entries2 = await repository.getAll();
      expect(entries1).not.toBe(entries2);
    });
  });

  describe('init', () => {
    it('should load entries from file', async () => {
      const mockEntries: TrackingEntry[] = [
        {
          taskId: 'task-1',
          taskName: 'Test Task',
          branch: 'task-task-1',
          startedAt: '2024-01-01T00:00:00Z',
        },
      ];
      fs.writeFileSync(trackingFilePath, JSON.stringify(mockEntries));

      await repository.init();

      const entries = await repository.getAll();
      expect(entries).toEqual(mockEntries);
    });
  });
});

describe('ReviewTrackingRepository', () => {
  let tempDir: string;
  let trackingFilePath: string;
  let repository: ReviewTrackingRepository;

  beforeEach(() => {
    tempDir = createTempDir('review-tracking-test');
    trackingFilePath = `${tempDir}/review-tracking.json`;
    repository = new ReviewTrackingRepository(trackingFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty array when file does not exist', async () => {
      const entries = await repository.load();
      expect(entries).toEqual([]);
    });

    it('should load entries from file', async () => {
      const mockEntries: ReviewEntry[] = [
        {
          taskId: 'task-1',
          taskName: 'Test Task',
          branch: 'task-task-1',
          prNumber: 123,
          prUrl: 'https://github.com/pr/123',
          stage: 'waiting_for_codex_review',
          iteration: 0,
          maxIterations: 3,
          startedAt: '2024-01-01T00:00:00Z',
          lastCommitSha: null,
        },
      ];
      fs.writeFileSync(trackingFilePath, JSON.stringify(mockEntries));

      const entries = await repository.load();
      expect(entries).toEqual(mockEntries);
    });

    it('should throw FileReadError on invalid JSON', async () => {
      fs.writeFileSync(trackingFilePath, 'invalid json');

      await expect(repository.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save entries to file', async () => {
      const entries: ReviewEntry[] = [
        {
          taskId: 'task-1',
          taskName: 'Test Task',
          branch: 'task-task-1',
          prNumber: 123,
          prUrl: 'https://github.com/pr/123',
          stage: 'waiting_for_codex_review',
          iteration: 0,
          maxIterations: 3,
          startedAt: '2024-01-01T00:00:00Z',
          lastCommitSha: null,
        },
      ];

      await repository.save(entries);

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(entries);
    });

    it('should throw FileWriteError when file cannot be written', async () => {
      const invalidRepo = new ReviewTrackingRepository('/invalid/path/review.json');
      const entries: ReviewEntry[] = [];

      await expect(invalidRepo.save(entries)).rejects.toThrow(FileWriteError);
    });
  });

  describe('startReviewCycle', () => {
    it('should start new review cycle', async () => {
      const task: ClickUpTaskData = {
        id: 'task-1',
        name: 'Test Task',
      };
      const prInfo = {
        branch: 'feature/test',
        prNumber: 123,
        prUrl: 'https://github.com/pr/123',
      };
      const repoConfig = {
        repository: 'test/repo',
        owner: 'test',
        repo: 'repo',
        repoPath: '/path/to/repo',
      };

      const result = await repository.startReviewCycle(task, prInfo, repoConfig);

      expect(result).toBe(true);

      const entries = await repository.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].taskId).toBe('task-1');
      expect(entries[0].taskName).toBe('Test Task');
      expect(entries[0].branch).toBe('feature/test');
      expect(entries[0].prNumber).toBe(123);
      expect(entries[0].prUrl).toBe('https://github.com/pr/123');
      expect(entries[0].stage).toBe('waiting_for_codex_review');
      expect(entries[0].iteration).toBe(0);
      expect(entries[0].maxIterations).toBe(3);
      expect(entries[0].repository).toBe('test/repo');
    });

    it('should return false if review cycle already exists', async () => {
      const task: ClickUpTaskData = {
        id: 'task-1',
        name: 'Test Task',
      };
      const prInfo = { prNumber: 123 };
      const repoConfig = {};

      await repository.startReviewCycle(task, prInfo, repoConfig);
      const result = await repository.startReviewCycle(task, prInfo, repoConfig);

      expect(result).toBe(false);

      const entries = await repository.getAll();
      expect(entries).toHaveLength(1);
    });

    it('should use default branch name if not provided', async () => {
      const task: ClickUpTaskData = {
        id: 'task-1',
        name: 'Test Task',
      };

      await repository.startReviewCycle(task, {}, {});

      const entries = await repository.getAll();
      expect(entries[0].branch).toBe('task-task-1');
    });

    it('should use title field if name not provided', async () => {
      const task: ClickUpTaskData = {
        id: 'task-1',
        name: 'Test Title',
      };

      await repository.startReviewCycle(task, {}, {});

      const entries = await repository.getAll();
      expect(entries[0].taskName).toBe('Test Title');
    });
  });

  describe('updateStage', () => {
    beforeEach(async () => {
      const task: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      await repository.startReviewCycle(task, {}, {});
    });

    it('should update stage', async () => {
      await repository.updateStage('task-1', 'codex_reviewing');

      const entry = await repository.get('task-1');
      expect(entry?.stage).toBe('codex_reviewing');
    });

    it('should persist changes to file', async () => {
      await repository.updateStage('task-1', 'codex_reviewing');

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed[0].stage).toBe('codex_reviewing');
    });

    it('should handle non-existent entry gracefully', async () => {
      await repository.updateStage('non-existent', 'codex_reviewing');

      const entry = await repository.get('non-existent');
      expect(entry).toBeNull();
    });
  });

  describe('updateIteration', () => {
    beforeEach(async () => {
      const task: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      await repository.startReviewCycle(task, {}, {});
    });

    it('should update iteration count', async () => {
      await repository.updateIteration('task-1', 2);

      const entry = await repository.get('task-1');
      expect(entry?.iteration).toBe(2);
    });

    it('should persist changes to file', async () => {
      await repository.updateIteration('task-1', 2);

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed[0].iteration).toBe(2);
    });
  });

  describe('updateCommitSha', () => {
    beforeEach(async () => {
      const task: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      await repository.startReviewCycle(task, {}, {});
    });

    it('should update commit SHA', async () => {
      const sha = 'abc123def456';
      await repository.updateCommitSha('task-1', sha);

      const entry = await repository.get('task-1');
      expect(entry?.lastCommitSha).toBe(sha);
    });

    it('should persist changes to file', async () => {
      const sha = 'abc123def456';
      await repository.updateCommitSha('task-1', sha);

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed[0].lastCommitSha).toBe(sha);
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      const task1: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      const task2: ClickUpTaskData = { id: 'task-2', name: 'Task 2' };
      await repository.startReviewCycle(task1, {}, {});
      await repository.startReviewCycle(task2, {}, {});
    });

    it('should remove review entry', async () => {
      await repository.remove('task-1');

      const entries = await repository.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].taskId).toBe('task-2');
    });

    it('should persist changes to file', async () => {
      await repository.remove('task-1');

      const fileContent = fs.readFileSync(trackingFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toHaveLength(1);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      const task: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      await repository.startReviewCycle(task, { prNumber: 123 }, {});
    });

    it('should return entry when it exists', async () => {
      const entry = await repository.get('task-1');

      expect(entry).toBeDefined();
      expect(entry?.taskId).toBe('task-1');
      expect(entry?.prNumber).toBe(123);
    });

    it('should return null when entry does not exist', async () => {
      const entry = await repository.get('non-existent');

      expect(entry).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no entries', async () => {
      const entries = await repository.getAll();
      expect(entries).toEqual([]);
    });

    it('should return all entries', async () => {
      const task1: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      const task2: ClickUpTaskData = { id: 'task-2', name: 'Task 2' };
      await repository.startReviewCycle(task1, {}, {});
      await repository.startReviewCycle(task2, {}, {});

      const entries = await repository.getAll();
      expect(entries).toHaveLength(2);
    });

    it('should return a copy of the array', async () => {
      const task: ClickUpTaskData = { id: 'task-1', name: 'Task 1' };
      await repository.startReviewCycle(task, {}, {});

      const entries1 = await repository.getAll();
      const entries2 = await repository.getAll();
      expect(entries1).not.toBe(entries2);
    });
  });

  describe('init', () => {
    it('should load entries from file', async () => {
      const mockEntries: ReviewEntry[] = [
        {
          taskId: 'task-1',
          taskName: 'Test Task',
          branch: 'task-task-1',
          prNumber: 123,
          prUrl: 'https://github.com/pr/123',
          stage: 'waiting_for_codex_review',
          iteration: 0,
          maxIterations: 3,
          startedAt: '2024-01-01T00:00:00Z',
          lastCommitSha: null,
        },
      ];
      fs.writeFileSync(trackingFilePath, JSON.stringify(mockEntries));

      await repository.init();

      const entries = await repository.getAll();
      expect(entries).toEqual(mockEntries);
    });
  });
});

describe('ProcessedCommentsRepository', () => {
  let tempDir: string;
  let commentsFilePath: string;
  let repository: ProcessedCommentsRepository;

  beforeEach(() => {
    tempDir = createTempDir('comments-test');
    commentsFilePath = `${tempDir}/comments.json`;
    repository = new ProcessedCommentsRepository(commentsFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty set when file does not exist', async () => {
      const commentIds = await repository.load();
      expect(commentIds.size).toBe(0);
    });

    it('should load comment IDs from file', async () => {
      const mockIds = ['comment-1', 'comment-2'];
      fs.writeFileSync(commentsFilePath, JSON.stringify(mockIds));

      const commentIds = await repository.load();
      expect(commentIds.size).toBe(2);
      expect(commentIds.has('comment-1')).toBe(true);
      expect(commentIds.has('comment-2')).toBe(true);
    });

    it('should throw FileReadError on invalid JSON', async () => {
      fs.writeFileSync(commentsFilePath, 'invalid json');

      await expect(repository.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save comment IDs to file', async () => {
      const commentIds = new Set(['comment-1', 'comment-2']);

      await repository.save(commentIds);

      const fileContent = fs.readFileSync(commentsFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(expect.arrayContaining(['comment-1', 'comment-2']));
      expect(parsed).toHaveLength(2);
    });

    it('should throw FileWriteError when file cannot be written', async () => {
      const invalidRepo = new ProcessedCommentsRepository('/invalid/path/comments.json');
      const commentIds = new Set<string>();

      await expect(invalidRepo.save(commentIds)).rejects.toThrow(FileWriteError);
    });
  });

  describe('has', () => {
    beforeEach(async () => {
      await repository.add('comment-1');
    });

    it('should return true when comment ID exists', async () => {
      const exists = await repository.has('comment-1');
      expect(exists).toBe(true);
    });

    it('should return false when comment ID does not exist', async () => {
      const exists = await repository.has('comment-2');
      expect(exists).toBe(false);
    });
  });

  describe('add', () => {
    it('should add comment ID', async () => {
      await repository.add('comment-1');

      const has = await repository.has('comment-1');
      expect(has).toBe(true);
    });

    it('should persist to file', async () => {
      await repository.add('comment-1');

      const fileContent = fs.readFileSync(commentsFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toContain('comment-1');
    });

    it('should not add duplicate IDs', async () => {
      await repository.add('comment-1');
      await repository.add('comment-1');

      const fileContent = fs.readFileSync(commentsFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toHaveLength(1);
    });

    it('should add multiple unique IDs', async () => {
      await repository.add('comment-1');
      await repository.add('comment-2');
      await repository.add('comment-3');

      const fileContent = fs.readFileSync(commentsFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toHaveLength(3);
    });
  });

  describe('init', () => {
    it('should load comment IDs from file', async () => {
      const mockIds = ['comment-1', 'comment-2'];
      fs.writeFileSync(commentsFilePath, JSON.stringify(mockIds));

      await repository.init();

      const has1 = await repository.has('comment-1');
      const has2 = await repository.has('comment-2');
      expect(has1).toBe(true);
      expect(has2).toBe(true);
    });
  });
});
