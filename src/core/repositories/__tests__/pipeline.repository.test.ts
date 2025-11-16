/**
 * Pipeline Repository Tests - Stale Task Detection
 */

import fs from 'fs';
import { PipelineRepository } from '../pipeline.repository';
import { createTempDir, cleanupTempDir } from '../../../test-setup';
import { PIPELINE_STAGES, PIPELINE_STATUS } from '../../../shared/constants';
import type { PipelineData } from '../../../types';

describe('PipelineRepository - Stale Task Detection', () => {
  let tempDir: string;
  let pipelineFilePath: string;
  let repository: PipelineRepository;

  beforeEach(() => {
    tempDir = createTempDir('pipeline-test');
    pipelineFilePath = `${tempDir}/pipeline-state.json`;
    repository = new PipelineRepository(pipelineFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('init', () => {
    it('should initialize pipeline with lastUpdatedAt timestamp', async () => {
      const pipeline = await repository.init('task-1', { name: 'Test Task' });

      expect(pipeline.lastUpdatedAt).toBeDefined();
      expect(typeof pipeline.lastUpdatedAt).toBe('number');
      expect(pipeline.lastUpdatedAt).toBeGreaterThan(0);
    });

    it('should set lastUpdatedAt to current time', async () => {
      const before = Date.now();
      const pipeline = await repository.init('task-1', { name: 'Test Task' });
      const after = Date.now();

      expect(pipeline.lastUpdatedAt).toBeGreaterThanOrEqual(before);
      expect(pipeline.lastUpdatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('updateStage', () => {
    it('should update lastUpdatedAt when stage is updated', async () => {
      await repository.init('task-1', { name: 'Test Task' });

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);

      expect(updated.lastUpdatedAt).toBeDefined();
      expect(typeof updated.lastUpdatedAt).toBe('number');
    });
  });

  describe('findStale', () => {
    it('should return empty array when no pipelines exist', async () => {
      const stalePipelines = await repository.findStale(30 * 60 * 1000);
      expect(stalePipelines).toEqual([]);
    });

    it('should return empty array when no stale pipelines exist', async () => {
      // Create a fresh pipeline
      await repository.init('task-1', { name: 'Test Task' });

      const stalePipelines = await repository.findStale(30 * 60 * 1000);
      expect(stalePipelines).toEqual([]);
    });

    it('should detect stale pipeline with old lastUpdatedAt', async () => {
      // Create a pipeline with old lastUpdatedAt
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      const pipelines: Record<string, PipelineData> = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task',
          currentStage: PIPELINE_STAGES.IMPLEMENTING,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: new Date(oneHourAgo).toISOString(),
          updatedAt: new Date(oneHourAgo).toISOString(),
          lastUpdatedAt: oneHourAgo,
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      fs.writeFileSync(pipelineFilePath, JSON.stringify(pipelines, null, 2));

      const stalePipelines = await repository.findStale(30 * 60 * 1000); // 30 minutes timeout
      expect(stalePipelines).toHaveLength(1);
      expect(stalePipelines[0].taskId).toBe('task-1');
    });

    it('should not detect pipeline that is still active', async () => {
      // Create a pipeline with recent lastUpdatedAt
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);

      const pipelines: Record<string, PipelineData> = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task',
          currentStage: PIPELINE_STAGES.IMPLEMENTING,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: new Date(fiveMinutesAgo).toISOString(),
          updatedAt: new Date(fiveMinutesAgo).toISOString(),
          lastUpdatedAt: fiveMinutesAgo,
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      fs.writeFileSync(pipelineFilePath, JSON.stringify(pipelines, null, 2));

      const stalePipelines = await repository.findStale(30 * 60 * 1000); // 30 minutes timeout
      expect(stalePipelines).toEqual([]);
    });

    it('should not detect completed pipelines as stale', async () => {
      // Create a completed pipeline with old lastUpdatedAt
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      const pipelines: Record<string, PipelineData> = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task',
          currentStage: PIPELINE_STAGES.COMPLETED,
          status: PIPELINE_STATUS.COMPLETED,
          createdAt: new Date(oneHourAgo).toISOString(),
          updatedAt: new Date(oneHourAgo).toISOString(),
          lastUpdatedAt: oneHourAgo,
          completedAt: new Date(oneHourAgo).toISOString(),
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      fs.writeFileSync(pipelineFilePath, JSON.stringify(pipelines, null, 2));

      const stalePipelines = await repository.findStale(30 * 60 * 1000);
      expect(stalePipelines).toEqual([]);
    });

    it('should not detect failed pipelines as stale', async () => {
      // Create a failed pipeline with old lastUpdatedAt
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      const pipelines: Record<string, PipelineData> = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task',
          currentStage: PIPELINE_STAGES.FAILED,
          status: PIPELINE_STATUS.FAILED,
          createdAt: new Date(oneHourAgo).toISOString(),
          updatedAt: new Date(oneHourAgo).toISOString(),
          lastUpdatedAt: oneHourAgo,
          failedAt: new Date(oneHourAgo).toISOString(),
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      fs.writeFileSync(pipelineFilePath, JSON.stringify(pipelines, null, 2));

      const stalePipelines = await repository.findStale(30 * 60 * 1000);
      expect(stalePipelines).toEqual([]);
    });

    it('should detect multiple stale pipelines', async () => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);

      const pipelines: Record<string, PipelineData> = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task 1',
          currentStage: PIPELINE_STAGES.IMPLEMENTING,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: new Date(oneHourAgo).toISOString(),
          updatedAt: new Date(oneHourAgo).toISOString(),
          lastUpdatedAt: oneHourAgo,
          stages: [],
          metadata: {},
          errors: [],
        },
        'task-2': {
          taskId: 'task-2',
          taskName: 'Test Task 2',
          currentStage: PIPELINE_STAGES.ANALYZING,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: new Date(twoHoursAgo).toISOString(),
          updatedAt: new Date(twoHoursAgo).toISOString(),
          lastUpdatedAt: twoHoursAgo,
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      fs.writeFileSync(pipelineFilePath, JSON.stringify(pipelines, null, 2));

      const stalePipelines = await repository.findStale(30 * 60 * 1000);
      expect(stalePipelines).toHaveLength(2);
      expect(stalePipelines.map(p => p.taskId).sort()).toEqual(['task-1', 'task-2']);
    });

    it('should handle custom timeout values', async () => {
      const now = Date.now();
      const tenMinutesAgo = now - (10 * 60 * 1000);

      const pipelines: Record<string, PipelineData> = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task',
          currentStage: PIPELINE_STAGES.IMPLEMENTING,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: new Date(tenMinutesAgo).toISOString(),
          updatedAt: new Date(tenMinutesAgo).toISOString(),
          lastUpdatedAt: tenMinutesAgo,
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      fs.writeFileSync(pipelineFilePath, JSON.stringify(pipelines, null, 2));

      // Should be stale with 5 minute timeout
      const stale5min = await repository.findStale(5 * 60 * 1000);
      expect(stale5min).toHaveLength(1);

      // Should NOT be stale with 15 minute timeout
      const stale15min = await repository.findStale(15 * 60 * 1000);
      expect(stale15min).toEqual([]);
    });
  });
});
