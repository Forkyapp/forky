/**
 * Cache Repository Tests
 */

import fs from 'fs';
import { CacheRepository } from '../cache.repository';
import { FileReadError, FileWriteError } from '../../../shared/errors';
import { createTempDir, cleanupTempDir, createMockClickUpTask } from '../../../test-setup';

describe('CacheRepository', () => {
  let tempDir: string;
  let cacheFilePath: string;
  let repository: CacheRepository;

  beforeEach(() => {
    tempDir = createTempDir('cache-test');
    cacheFilePath = `${tempDir}/cache.json`;
    repository = new CacheRepository(cacheFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty array when file does not exist', async () => {
      const tasks = await repository.load();
      expect(tasks).toEqual([]);
    });

    it('should load tasks from file', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Description 1',
          detectedAt: '2024-01-01T00:00:00Z',
        },
      ];
      fs.writeFileSync(cacheFilePath, JSON.stringify(mockTasks));

      const tasks = await repository.load();
      expect(tasks).toEqual(mockTasks);
    });

    it('should handle legacy format (array of strings)', async () => {
      const legacyData = ['task-1', 'task-2'];
      fs.writeFileSync(cacheFilePath, JSON.stringify(legacyData));

      const tasks = await repository.load();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[0].title).toBe('Unknown');
    });

    it('should throw FileReadError on invalid JSON', async () => {
      fs.writeFileSync(cacheFilePath, 'invalid json');

      await expect(repository.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save tasks to file', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Description 1',
          detectedAt: '2024-01-01T00:00:00Z',
        },
      ];

      await repository.save(tasks);

      const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(tasks);
    });

    it('should throw FileWriteError when file cannot be written', async () => {
      const invalidRepo = new CacheRepository('/invalid/path/cache.json');
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Description 1',
          detectedAt: '2024-01-01T00:00:00Z',
        },
      ];

      await expect(invalidRepo.save(tasks)).rejects.toThrow(FileWriteError);
    });
  });

  describe('has', () => {
    it('should return false when task does not exist', async () => {
      const exists = await repository.has('non-existent');
      expect(exists).toBe(false);
    });

    it('should return true when task exists', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task);

      const exists = await repository.has('task-1');
      expect(exists).toBe(true);
    });
  });

  describe('add', () => {
    it('should add task to cache', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task);

      const tasks = await repository.getAll();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-1');
    });

    it('should not add duplicate task', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task);
      await repository.add(task);

      const tasks = await repository.getAll();
      expect(tasks).toHaveLength(1);
    });

    it('should handle task with name field', async () => {
      const task = createMockClickUpTask({ id: 'task-1', name: 'Task Name' });
      await repository.add(task);

      const tasks = await repository.getAll();
      expect(tasks[0].title).toBe('Task Name');
    });

    it('should handle task with title field', async () => {
      const task = createMockClickUpTask({ id: 'task-1', title: 'Task Title', name: undefined });
      await repository.add(task);

      const tasks = await repository.getAll();
      expect(tasks[0].title).toBe('Task Title');
    });

    it('should persist task to file', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task);

      const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('task-1');
    });
  });

  describe('getAll', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await repository.getAll();
      expect(tasks).toEqual([]);
    });

    it('should return all tasks', async () => {
      const task1 = createMockClickUpTask({ id: 'task-1' });
      const task2 = createMockClickUpTask({ id: 'task-2' });
      await repository.add(task1);
      await repository.add(task2);

      const tasks = await repository.getAll();
      expect(tasks).toHaveLength(2);
    });

    it('should return a copy of tasks array', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task);

      const tasks1 = await repository.getAll();
      const tasks2 = await repository.getAll();
      expect(tasks1).not.toBe(tasks2);
    });
  });

  describe('clear', () => {
    it('should clear all tasks', async () => {
      const task1 = createMockClickUpTask({ id: 'task-1' });
      const task2 = createMockClickUpTask({ id: 'task-2' });
      await repository.add(task1);
      await repository.add(task2);

      await repository.clear();

      const tasks = await repository.getAll();
      expect(tasks).toEqual([]);
    });

    it('should persist cleared state to file', async () => {
      const task = createMockClickUpTask({ id: 'task-1' });
      await repository.add(task);
      await repository.clear();

      const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual([]);
    });
  });

  describe('init', () => {
    it('should load tasks from file', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Description 1',
          detectedAt: '2024-01-01T00:00:00Z',
        },
      ];
      fs.writeFileSync(cacheFilePath, JSON.stringify(mockTasks));

      await repository.init();

      const tasks = await repository.getAll();
      expect(tasks).toEqual(mockTasks);
    });
  });
});
