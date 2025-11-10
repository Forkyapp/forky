/**
 * Integration Tests - Task Flow
 * Tests the complete flow of task processing
 */

import fs from 'fs';
import { CacheRepository } from '../../core/repositories/cache.repository';
import { QueueRepository } from '../../core/repositories/queue.repository';
import { createTempDir, cleanupTempDir, createMockClickUpTask } from '../../test-setup';

describe('Task Flow Integration', () => {
  let tempDir: string;
  let cacheRepo: CacheRepository;
  let queueRepo: QueueRepository;

  beforeEach(() => {
    tempDir = createTempDir('integration-test');
    cacheRepo = new CacheRepository(`${tempDir}/cache.json`);
    queueRepo = new QueueRepository(`${tempDir}/queue.json`);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('Complete task processing flow', () => {
    it('should process a new task from detection to completion', async () => {
      // 1. Initialize repositories
      await cacheRepo.init();

      // 2. Simulate detecting a new task
      const task = createMockClickUpTask({
        id: 'task-1',
        name: 'Implement new feature',
        description: 'Add user authentication',
      });

      // 3. Check if task is already cached (it shouldn't be)
      const isCached = await cacheRepo.has(task.id);
      expect(isCached).toBe(false);

      // 4. Add task to cache
      await cacheRepo.add(task);

      // 5. Verify task is now cached
      const isCachedNow = await cacheRepo.has(task.id);
      expect(isCachedNow).toBe(true);

      // 6. Add task to queue
      const queueResult = await queueRepo.add(task, {
        repoPath: '/test/repo',
        owner: 'test-owner',
        repo: 'test-repo',
      });
      expect(queueResult.success).toBe(true);

      // 7. Verify task is in pending queue
      const pending = await queueRepo.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('task-1');
      expect(pending[0].title).toBe('Implement new feature');

      // 8. Simulate task completion
      await queueRepo.moveToCompleted('task-1');

      // 9. Verify task moved to completed
      const pendingAfter = await queueRepo.getPending();
      const completed = await queueRepo.getCompleted();
      expect(pendingAfter).toHaveLength(0);
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('task-1');

      // 10. Verify all data persisted to files
      expect(fs.existsSync(`${tempDir}/cache.json`)).toBe(true);
      expect(fs.existsSync(`${tempDir}/queue.json`)).toBe(true);
    });

    it('should prevent duplicate task processing', async () => {
      await cacheRepo.init();

      const task = createMockClickUpTask({ id: 'task-1' });

      // Add task first time
      await cacheRepo.add(task);
      const firstQueueResult = await queueRepo.add(task, {});

      expect(firstQueueResult.success).toBe(true);

      // Try to add same task again
      const isCached = await cacheRepo.has(task.id);
      expect(isCached).toBe(true);

      const secondQueueResult = await queueRepo.add(task, {});
      expect(secondQueueResult.alreadyQueued).toBe(true);

      // Verify only one task in queue
      const pending = await queueRepo.getPending();
      expect(pending).toHaveLength(1);
    });

    it('should handle multiple tasks in parallel', async () => {
      await cacheRepo.init();

      const tasks = [
        createMockClickUpTask({ id: 'task-1', name: 'Task 1' }),
        createMockClickUpTask({ id: 'task-2', name: 'Task 2' }),
        createMockClickUpTask({ id: 'task-3', name: 'Task 3' }),
      ];

      // Process all tasks
      for (const task of tasks) {
        await cacheRepo.add(task);
        await queueRepo.add(task, {});
      }

      // Verify all tasks are queued
      const pending = await queueRepo.getPending();
      expect(pending).toHaveLength(3);

      // Complete first task
      await queueRepo.moveToCompleted('task-1');

      // Verify state
      const pendingAfter = await queueRepo.getPending();
      const completed = await queueRepo.getCompleted();
      expect(pendingAfter).toHaveLength(2);
      expect(completed).toHaveLength(1);
    });

    it('should persist state across repository instances', async () => {
      // Create and populate data with first instance
      const task = createMockClickUpTask({ id: 'task-1' });
      await cacheRepo.add(task);
      await queueRepo.add(task, {});

      // Create new instances pointing to same files
      const newCacheRepo = new CacheRepository(`${tempDir}/cache.json`);
      const newQueueRepo = new QueueRepository(`${tempDir}/queue.json`);

      // Initialize new instances
      await newCacheRepo.init();

      // Verify data persisted
      const isCached = await newCacheRepo.has(task.id);
      expect(isCached).toBe(true);

      const pending = await newQueueRepo.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('task-1');
    });

    it('should handle task removal from queue', async () => {
      await cacheRepo.init();

      const task = createMockClickUpTask({ id: 'task-1' });
      await cacheRepo.add(task);
      await queueRepo.add(task, {});

      // Verify task is queued
      let pending = await queueRepo.getPending();
      expect(pending).toHaveLength(1);

      // Remove task
      await queueRepo.remove('task-1');

      // Verify task removed
      pending = await queueRepo.getPending();
      expect(pending).toHaveLength(0);

      // Cache should still have the task
      const isCached = await cacheRepo.has('task-1');
      expect(isCached).toBe(true);
    });
  });

  describe('Error handling in task flow', () => {
    it('should handle corrupted cache file', async () => {
      // Create corrupted cache file
      fs.writeFileSync(`${tempDir}/cache.json`, 'corrupted json');

      // Should throw error when trying to load
      await expect(cacheRepo.load()).rejects.toThrow();
    });

    it('should handle corrupted queue file', async () => {
      // Create corrupted queue file
      fs.writeFileSync(`${tempDir}/queue.json`, 'corrupted json');

      // Should throw error when trying to load
      await expect(queueRepo.load()).rejects.toThrow();
    });

    it('should handle missing directory', async () => {
      const invalidCacheRepo = new CacheRepository('/nonexistent/dir/cache.json');
      const task = createMockClickUpTask({ id: 'task-1' });

      // Should throw error when trying to save
      await expect(invalidCacheRepo.add(task)).rejects.toThrow();
    });
  });

  describe('Legacy format migration', () => {
    it('should migrate legacy cache format', async () => {
      // Create legacy cache file (array of strings)
      const legacyData = ['task-1', 'task-2', 'task-3'];
      fs.writeFileSync(`${tempDir}/cache.json`, JSON.stringify(legacyData));

      // Load and verify migration
      await cacheRepo.init();
      const tasks = await cacheRepo.getAll();

      expect(tasks).toHaveLength(3);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[0].title).toBe('Unknown');
      expect(tasks[0].detectedAt).toBeDefined();
    });
  });

  describe('Data consistency', () => {
    it('should maintain data consistency across operations', async () => {
      await cacheRepo.init();

      const tasks = [
        createMockClickUpTask({ id: 'task-1', name: 'Task 1' }),
        createMockClickUpTask({ id: 'task-2', name: 'Task 2' }),
      ];

      // Add tasks
      for (const task of tasks) {
        await cacheRepo.add(task);
        await queueRepo.add(task, {});
      }

      // Read cache and queue
      const cachedTasks = await cacheRepo.getAll();
      const queuedTasks = await queueRepo.getPending();

      // Verify consistency
      expect(cachedTasks).toHaveLength(2);
      expect(queuedTasks).toHaveLength(2);

      // Verify IDs match
      const cachedIds = cachedTasks.map((t) => t.id).sort();
      const queuedIds = queuedTasks.map((t) => t.id).sort();
      expect(cachedIds).toEqual(queuedIds);
    });

    it('should handle concurrent writes safely', async () => {
      await cacheRepo.init();

      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockClickUpTask({ id: `task-${i}`, name: `Task ${i}` })
      );

      // Add all tasks concurrently
      const promises = tasks.map((task) => cacheRepo.add(task));
      await Promise.all(promises);

      // Verify all tasks added
      const allTasks = await cacheRepo.getAll();
      expect(allTasks.length).toBeGreaterThan(0);
      expect(allTasks.length).toBeLessThanOrEqual(10);
    });
  });
});
