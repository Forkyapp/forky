/**
 * Integration Tests - Repository Interactions
 * Tests interactions between different repository types
 */

import { CacheRepository } from '../../core/repositories/cache.repository';
import { QueueRepository } from '../../core/repositories/queue.repository';
import { JSONStorage } from '../../infrastructure/storage/json-storage';
import { createTempDir, cleanupTempDir, createMockClickUpTask } from '../../test-setup';

describe('Repository Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('repo-integration-test');
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Cache and Queue coordination', () => {
    it('should maintain synchronized state between cache and queue', async () => {
      const cacheRepo = new CacheRepository(`${tempDir}/cache.json`);
      const queueRepo = new QueueRepository(`${tempDir}/queue.json`);

      await cacheRepo.init();

      const task = createMockClickUpTask({ id: 'task-1', name: 'Test Task' });

      // Add to cache first
      await cacheRepo.add(task);
      expect(await cacheRepo.has(task.id)).toBe(true);

      // Then add to queue
      await queueRepo.add(task, {});
      const pending = await queueRepo.getPending();
      expect(pending).toHaveLength(1);

      // Complete in queue
      await queueRepo.moveToCompleted(task.id);

      // Cache should still have it
      expect(await cacheRepo.has(task.id)).toBe(true);
    });

    it('should prevent queueing of uncached tasks via workflow check', async () => {
      const cacheRepo = new CacheRepository(`${tempDir}/cache.json`);
      const queueRepo = new QueueRepository(`${tempDir}/queue.json`);

      await cacheRepo.init();

      const task = createMockClickUpTask({ id: 'task-1' });

      // In real workflow, we check cache before queueing
      const shouldQueue = !(await cacheRepo.has(task.id));
      expect(shouldQueue).toBe(true);

      // Add to cache and queue
      await cacheRepo.add(task);
      await queueRepo.add(task, {});

      // Try to process same task again
      const shouldQueueAgain = !(await cacheRepo.has(task.id));
      expect(shouldQueueAgain).toBe(false);
    });
  });

  describe('Storage layer integration', () => {
    it('should work with custom storage layer', async () => {
      const storage = new JSONStorage(`${tempDir}/custom.json`, { tasks: [], processed: [] });

      // Write some data
      await storage.write({ tasks: [], processed: [] });

      // Read it back
      const data = await storage.read();
      expect(data).toEqual({ tasks: [], processed: [] });
    });

    it('should handle multiple storage instances', async () => {
      const storage1 = new JSONStorage(`${tempDir}/data1.json`, { source: 'storage1' });
      const storage2 = new JSONStorage(`${tempDir}/data2.json`, { source: 'storage2' });

      await storage1.write({ source: 'storage1' });
      await storage2.write({ source: 'storage2' });

      const data1 = await storage1.read();
      const data2 = await storage2.read();

      expect(data1).toEqual({ source: 'storage1' });
      expect(data2).toEqual({ source: 'storage2' });
    });
  });

  describe('Cross-repository operations', () => {
    it('should support bulk operations across repositories', async () => {
      const cacheRepo = new CacheRepository(`${tempDir}/cache.json`);
      const queueRepo = new QueueRepository(`${tempDir}/queue.json`);

      await cacheRepo.init();

      // Create multiple tasks
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createMockClickUpTask({ id: `task-${i}`, name: `Task ${i}` })
      );

      // Process all tasks
      for (const task of tasks) {
        await cacheRepo.add(task);
        await queueRepo.add(task, { owner: 'test', repo: 'test' });
      }

      // Verify cache state
      const cachedTasks = await cacheRepo.getAll();
      expect(cachedTasks).toHaveLength(5);

      // Verify queue state
      const pendingTasks = await queueRepo.getPending();
      expect(pendingTasks).toHaveLength(5);

      // Complete all tasks
      for (const task of tasks) {
        await queueRepo.moveToCompleted(task.id);
      }

      // Verify final state
      const pending = await queueRepo.getPending();
      const completed = await queueRepo.getCompleted();
      expect(pending).toHaveLength(0);
      expect(completed).toHaveLength(5);
    });

    it('should support selective cleanup', async () => {
      const cacheRepo = new CacheRepository(`${tempDir}/cache.json`);
      const queueRepo = new QueueRepository(`${tempDir}/queue.json`);

      await cacheRepo.init();

      // Add tasks
      const tasks = [
        createMockClickUpTask({ id: 'task-1' }),
        createMockClickUpTask({ id: 'task-2' }),
        createMockClickUpTask({ id: 'task-3' }),
      ];

      for (const task of tasks) {
        await cacheRepo.add(task);
        await queueRepo.add(task, {});
      }

      // Remove one task from queue
      await queueRepo.remove('task-2');

      // Verify queue state
      const pending = await queueRepo.getPending();
      expect(pending).toHaveLength(2);
      expect(pending.find((t) => t.id === 'task-2')).toBeUndefined();

      // Cache should still have all tasks
      expect(await cacheRepo.has('task-1')).toBe(true);
      expect(await cacheRepo.has('task-2')).toBe(true);
      expect(await cacheRepo.has('task-3')).toBe(true);
    });
  });

  describe('Error propagation', () => {
    it('should handle repository errors independently', async () => {
      const validCache = new CacheRepository(`${tempDir}/cache.json`);
      const invalidQueue = new QueueRepository('/invalid/path/queue.json');

      await validCache.init();

      const task = createMockClickUpTask({ id: 'task-1' });

      // Cache should work
      await expect(validCache.add(task)).resolves.not.toThrow();

      // Queue should fail
      await expect(invalidQueue.add(task, {})).rejects.toThrow();

      // Cache should still be functional
      expect(await validCache.has('task-1')).toBe(true);
    });
  });

  describe('State recovery', () => {
    it('should recover from partial failures', async () => {
      const cacheRepo = new CacheRepository(`${tempDir}/cache.json`);
      const queueRepo = new QueueRepository(`${tempDir}/queue.json`);

      await cacheRepo.init();

      const task1 = createMockClickUpTask({ id: 'task-1' });
      const task2 = createMockClickUpTask({ id: 'task-2' });

      // Successfully add first task
      await cacheRepo.add(task1);
      await queueRepo.add(task1, {});

      // Verify first task
      expect(await cacheRepo.has('task-1')).toBe(true);
      const pending = await queueRepo.getPending();
      expect(pending).toHaveLength(1);

      // Add second task
      await cacheRepo.add(task2);
      await queueRepo.add(task2, {});

      // Verify both tasks
      const allPending = await queueRepo.getPending();
      expect(allPending).toHaveLength(2);
    });
  });
});
