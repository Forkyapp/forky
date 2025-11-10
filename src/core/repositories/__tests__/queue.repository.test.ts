/**
 * Queue Repository Tests
 */

import fs from 'fs';
import { QueueRepository } from '../queue.repository';
import { FileReadError, FileWriteError } from '../../../shared/errors';
import { createTempDir, cleanupTempDir, createMockClickUpTask } from '../../../test-setup';

describe('QueueRepository', () => {
  let tempDir: string;
  let queueFilePath: string;
  let repository: QueueRepository;

  beforeEach(() => {
    tempDir = createTempDir('queue-test');
    queueFilePath = `${tempDir}/queue.json`;
    repository = new QueueRepository(queueFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty queue when file does not exist', async () => {
      const data = await repository.load();
      expect(data).toEqual({ pending: [], completed: [] });
    });

    it('should load queue data from file', async () => {
      const mockData = {
        pending: [
          {
            id: 'task-1',
            title: 'Task 1',
            description: 'Description 1',
            url: 'https://test.com/task-1',
            queuedAt: '2024-01-01T00:00:00Z',
            branch: 'task-task-1',
            commitMessage: 'feat: Task 1',
            prTitle: '[ClickUp #task-1] Task 1',
            prBody: 'Task body',
          },
        ],
        completed: [],
      };
      fs.writeFileSync(queueFilePath, JSON.stringify(mockData));

      const data = await repository.load();
      expect(data).toEqual(mockData);
    });

    it('should throw FileReadError on invalid JSON', async () => {
      fs.writeFileSync(queueFilePath, 'invalid json');

      await expect(repository.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save queue data to file', async () => {
      const data = {
        pending: [
          {
            id: 'task-1',
            title: 'Task 1',
            description: 'Description 1',
            url: 'https://test.com/task-1',
            queuedAt: '2024-01-01T00:00:00Z',
            branch: 'task-task-1',
            commitMessage: 'feat: Task 1',
            prTitle: '[ClickUp #task-1] Task 1',
            prBody: 'Task body',
          },
        ],
        completed: [],
      };

      await repository.save(data);

      const fileContent = fs.readFileSync(queueFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(data);
    });

    it('should throw FileWriteError when file cannot be written', async () => {
      const invalidRepo = new QueueRepository('/invalid/path/queue.json');
      const data = { pending: [], completed: [] };

      await expect(invalidRepo.save(data)).rejects.toThrow(FileWriteError);
    });
  });

  describe('add', () => {
    it('should add task to pending queue', async () => {
      const task = createMockClickUpTask({ id: 'task-1', name: 'Test Task' });
      const config = { repoPath: '/test/repo', owner: 'test-owner', repo: 'test-repo' };

      const result = await repository.add(task, config);

      expect(result.success).toBe(true);
      const pending = await repository.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('task-1');
      expect(pending[0].title).toBe('Test Task');
    });

    it('should not add duplicate task', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      const config = { repoPath: '/test/repo' };

      await repository.add(task, config);
      const result = await repository.add(task, config);

      expect(result.alreadyQueued).toBe(true);
      const pending = await repository.getPending();
      expect(pending).toHaveLength(1);
    });

    it('should generate correct branch name', async () => {
      const task = createMockClickUpTask({ id: 'task-123' });
      const config = {};

      await repository.add(task, config);

      const pending = await repository.getPending();
      expect(pending[0].branch).toBe('task-task-123');
    });

    it('should generate correct commit message', async () => {
      const task = createMockClickUpTask({ id: 'task-123', name: 'My Feature' });
      const config = {};

      await repository.add(task, config);

      const pending = await repository.getPending();
      expect(pending[0].commitMessage).toBe('feat: My Feature (#task-123)');
    });

    it('should generate correct PR title and body', async () => {
      const task = createMockClickUpTask({
        id: 'task-123',
        name: 'My Feature',
        description: 'Feature description',
        url: 'https://test.com/task-123',
      });
      const config = {};

      await repository.add(task, config);

      const pending = await repository.getPending();
      expect(pending[0].prTitle).toBe('[ClickUp #task-123] My Feature');
      expect(pending[0].prBody).toContain('My Feature');
      expect(pending[0].prBody).toContain('task-123');
      expect(pending[0].prBody).toContain('https://test.com/task-123');
    });

    it('should handle task with text_content instead of description', async () => {
      const task = createMockClickUpTask({
        id: 'task-1',
        description: undefined,
        text_content: 'Text content',
      });
      const config = {};

      await repository.add(task, config);

      const pending = await repository.getPending();
      expect(pending[0].description).toBe('Text content');
    });
  });

  describe('getPending', () => {
    it('should return empty array when no pending tasks', async () => {
      const pending = await repository.getPending();
      expect(pending).toEqual([]);
    });

    it('should return all pending tasks', async () => {
      const task1 = createMockClickUpTask({ id: 'task-1' });
      const task2 = createMockClickUpTask({ id: 'task-2' });
      await repository.add(task1, {});
      await repository.add(task2, {});

      const pending = await repository.getPending();
      expect(pending).toHaveLength(2);
    });
  });

  describe('getCompleted', () => {
    it('should return empty array when no completed tasks', async () => {
      const completed = await repository.getCompleted();
      expect(completed).toEqual([]);
    });

    it('should return all completed tasks', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task, {});
      await repository.moveToCompleted('task-1');

      const completed = await repository.getCompleted();
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('task-1');
    });
  });

  describe('moveToCompleted', () => {
    it('should move task from pending to completed', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task, {});

      await repository.moveToCompleted('task-1');

      const pending = await repository.getPending();
      const completed = await repository.getCompleted();
      expect(pending).toHaveLength(0);
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('task-1');
    });

    it('should not throw error when task does not exist', async () => {
      await expect(repository.moveToCompleted('non-existent')).resolves.not.toThrow();
    });
  });

  describe('remove', () => {
    it('should remove task from pending queue', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task, {});

      await repository.remove('task-1');

      const pending = await repository.getPending();
      expect(pending).toHaveLength(0);
    });

    it('should remove task from completed queue', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task, {});
      await repository.moveToCompleted('task-1');

      await repository.remove('task-1');

      const completed = await repository.getCompleted();
      expect(completed).toHaveLength(0);
    });

    it('should not throw error when task does not exist', async () => {
      await expect(repository.remove('non-existent')).resolves.not.toThrow();
    });
  });
});
