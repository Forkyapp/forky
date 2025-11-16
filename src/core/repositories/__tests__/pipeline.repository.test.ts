/**
 * Pipeline Repository Tests
 */

import fs from 'fs';
import { PipelineRepository } from '../pipeline.repository';
import { PIPELINE_STAGES, PIPELINE_STATUS } from '../../../shared/constants';
import { FileReadError, FileWriteError, PipelineNotFoundError } from '../../../shared/errors';
import { createTempDir, cleanupTempDir } from '../../../test-setup';
import type { PipelineData } from '../../../types';

describe('PipelineRepository', () => {
  let tempDir: string;
  let pipelineFilePath: string;
  let repository: PipelineRepository;

  beforeEach(() => {
    tempDir = createTempDir('pipeline-test');
    pipelineFilePath = `${tempDir}/pipeline.json`;
    repository = new PipelineRepository(pipelineFilePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty object when file does not exist', async () => {
      const pipelines = await repository.load();
      expect(pipelines).toEqual({});
    });

    it('should load pipelines from file', async () => {
      const mockPipelines = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task',
          currentStage: PIPELINE_STAGES.DETECTED,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          stages: [],
          metadata: {},
          errors: [],
        },
      };
      fs.writeFileSync(pipelineFilePath, JSON.stringify(mockPipelines));

      const pipelines = await repository.load();
      expect(pipelines).toEqual(mockPipelines);
    });

    it('should throw FileReadError on invalid JSON', async () => {
      fs.writeFileSync(pipelineFilePath, 'invalid json');

      await expect(repository.load()).rejects.toThrow(FileReadError);
    });
  });

  describe('save', () => {
    it('should save pipelines to file', async () => {
      const pipelines = {
        'task-1': {
          taskId: 'task-1',
          taskName: 'Test Task',
          currentStage: PIPELINE_STAGES.DETECTED,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      await repository.save(pipelines);

      const fileContent = fs.readFileSync(pipelineFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(pipelines);
    });

    it('should throw FileWriteError when file cannot be written', async () => {
      const invalidRepo = new PipelineRepository('/invalid/path/pipeline.json');
      const pipelines = {};

      await expect(invalidRepo.save(pipelines)).rejects.toThrow(FileWriteError);
    });
  });

  describe('get', () => {
    it('should return null when pipeline does not exist', async () => {
      const pipeline = await repository.get('non-existent');
      expect(pipeline).toBeNull();
    });

    it('should return pipeline when it exists', async () => {
      const mockPipeline: PipelineData = {
        taskId: 'task-1',
        taskName: 'Test Task',
        currentStage: PIPELINE_STAGES.DETECTED,
        status: PIPELINE_STATUS.IN_PROGRESS,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        stages: [],
        metadata: {
          geminiAnalysis: null,
          aiInstances: [],
          branches: [],
          prNumber: null,
          reviewIterations: 0,
          maxReviewIterations: 3,
          agentExecution: {
            gemini: null,
            claude: null,
            codex: null,
          },
        },
        errors: [],
      };

      await repository.save({ 'task-1': mockPipeline });

      const pipeline = await repository.get('task-1');
      expect(pipeline).toEqual(mockPipeline);
    });
  });

  describe('init', () => {
    it('should initialize new pipeline with default values', async () => {
      const pipeline = await repository.init('task-1', {
        name: 'Test Task',
      });

      expect(pipeline.taskId).toBe('task-1');
      expect(pipeline.taskName).toBe('Test Task');
      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.DETECTED);
      expect(pipeline.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(pipeline.stages).toHaveLength(1);
      expect(pipeline.stages[0].stage).toBe(PIPELINE_STAGES.DETECTED);
      expect(pipeline.stages[0].status).toBe(PIPELINE_STATUS.COMPLETED);
      expect(pipeline.metadata).toBeDefined();
      expect(pipeline.errors).toEqual([]);
    });

    it('should use title field if name is not provided', async () => {
      const pipeline = await repository.init('task-1', {
        title: 'Test Title',
      });

      expect(pipeline.taskName).toBe('Test Title');
    });

    it('should persist pipeline to file', async () => {
      await repository.init('task-1', { name: 'Test Task' });

      const fileContent = fs.readFileSync(pipelineFilePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed['task-1']).toBeDefined();
      expect(parsed['task-1'].taskId).toBe('task-1');
    });

    it('should initialize metadata with correct structure', async () => {
      const pipeline = await repository.init('task-1', { name: 'Test Task' });

      expect(pipeline.metadata).toEqual({
        geminiAnalysis: null,
        aiInstances: [],
        branches: [],
        prNumber: null,
        reviewIterations: 0,
        maxReviewIterations: 3,
        agentExecution: {
          gemini: null,
          claude: null,
          codex: null,
        },
      });
    });
  });

  describe('updateStage', () => {
    beforeEach(async () => {
      await repository.init('task-1', { name: 'Test Task' });
    });

    it('should update existing stage', async () => {
      const pipeline = await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);

      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.ANALYZING);
      const stage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(stage).toBeDefined();
      expect(stage?.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(stage?.startedAt).toBeDefined();
    });

    it('should create new stage if it does not exist', async () => {
      const initialStages = (await repository.get('task-1'))!.stages.length;

      await repository.updateStage('task-1', PIPELINE_STAGES.IMPLEMENTING);

      const pipeline = await repository.get('task-1');
      expect(pipeline!.stages.length).toBe(initialStages + 1);
      const stage = pipeline!.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(stage).toBeDefined();
      expect(stage?.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
    });

    it('should throw PipelineNotFoundError when pipeline does not exist', async () => {
      await expect(
        repository.updateStage('non-existent', PIPELINE_STAGES.ANALYZING)
      ).rejects.toThrow(PipelineNotFoundError);
    });

    it('should update updatedAt timestamp', async () => {
      const before = (await repository.get('task-1'))!.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const pipeline = await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);

      expect(new Date(pipeline.updatedAt).getTime()).toBeGreaterThan(
        new Date(before).getTime()
      );
    });

    it('should accept custom stage data', async () => {
      const pipeline = await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING, {
        name: 'Custom Analysis Stage',
      });

      const stage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(stage?.name).toBe('Custom Analysis Stage');
    });
  });

  describe('completeStage', () => {
    beforeEach(async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);
    });

    it('should mark stage as completed', async () => {
      const pipeline = await repository.completeStage('task-1', PIPELINE_STAGES.ANALYZING);

      const stage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(stage?.status).toBe(PIPELINE_STATUS.COMPLETED);
      expect(stage?.completedAt).toBeDefined();
    });

    it('should calculate stage duration', async () => {
      const pipeline = await repository.completeStage('task-1', PIPELINE_STAGES.ANALYZING);

      const stage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(stage?.duration).toBeDefined();
      expect(stage?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw PipelineNotFoundError when pipeline does not exist', async () => {
      await expect(
        repository.completeStage('non-existent', PIPELINE_STAGES.ANALYZING)
      ).rejects.toThrow(PipelineNotFoundError);
    });

    it('should accept result data', async () => {
      const result = { analysis: 'completed', confidence: 0.95 };
      const pipeline = await repository.completeStage('task-1', PIPELINE_STAGES.ANALYZING, result);

      const stage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(stage).toMatchObject({
        ...result,
        status: PIPELINE_STATUS.COMPLETED,
      });
    });

    it('should update updatedAt timestamp', async () => {
      const before = (await repository.get('task-1'))!.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const pipeline = await repository.completeStage('task-1', PIPELINE_STAGES.ANALYZING);

      expect(new Date(pipeline.updatedAt).getTime()).toBeGreaterThan(
        new Date(before).getTime()
      );
    });
  });

  describe('failStage', () => {
    beforeEach(async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);
    });

    it('should mark stage as failed with Error object', async () => {
      const error = new Error('Analysis failed');
      const pipeline = await repository.failStage('task-1', PIPELINE_STAGES.ANALYZING, error);

      const stage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(stage?.status).toBe(PIPELINE_STATUS.FAILED);
      expect(stage?.error).toBe('Analysis failed');
      expect(stage?.completedAt).toBeDefined();
    });

    it('should mark stage as failed with error string', async () => {
      const pipeline = await repository.failStage(
        'task-1',
        PIPELINE_STAGES.ANALYZING,
        'Analysis failed'
      );

      const stage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(stage?.status).toBe(PIPELINE_STATUS.FAILED);
      expect(stage?.error).toBe('Analysis failed');
    });

    it('should add error to pipeline errors array', async () => {
      const pipeline = await repository.failStage(
        'task-1',
        PIPELINE_STAGES.ANALYZING,
        'Analysis failed'
      );

      expect(pipeline.errors).toHaveLength(1);
      expect(pipeline.errors[0]).toMatchObject({
        stage: PIPELINE_STAGES.ANALYZING,
        error: 'Analysis failed',
      });
      expect(pipeline.errors[0].timestamp).toBeDefined();
    });

    it('should throw PipelineNotFoundError when pipeline does not exist', async () => {
      await expect(
        repository.failStage('non-existent', PIPELINE_STAGES.ANALYZING, 'Error')
      ).rejects.toThrow(PipelineNotFoundError);
    });
  });

  describe('updateMetadata', () => {
    beforeEach(async () => {
      await repository.init('task-1', { name: 'Test Task' });
    });

    it('should update metadata', async () => {
      const metadata = {
        branches: ['feature/test'],
        prNumber: 123,
      };

      const pipeline = await repository.updateMetadata('task-1', metadata);

      expect(pipeline.metadata.branches).toEqual(['feature/test']);
      expect(pipeline.metadata.prNumber).toBe(123);
    });

    it('should merge with existing metadata', async () => {
      await repository.updateMetadata('task-1', { branches: ['feature/test'] });
      const pipeline = await repository.updateMetadata('task-1', { prNumber: 123 });

      expect(pipeline.metadata.branches).toEqual(['feature/test']);
      expect(pipeline.metadata.prNumber).toBe(123);
    });

    it('should throw PipelineNotFoundError when pipeline does not exist', async () => {
      await expect(
        repository.updateMetadata('non-existent', { test: 'data' })
      ).rejects.toThrow(PipelineNotFoundError);
    });
  });

  describe('complete', () => {
    beforeEach(async () => {
      await repository.init('task-1', { name: 'Test Task' });
    });

    it('should mark pipeline as completed', async () => {
      const pipeline = await repository.complete('task-1');

      expect(pipeline.status).toBe(PIPELINE_STATUS.COMPLETED);
      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.COMPLETED);
      expect(pipeline.completedAt).toBeDefined();
      expect(pipeline.totalDuration).toBeDefined();
    });

    it('should calculate total duration', async () => {
      const pipeline = await repository.complete('task-1');

      expect(pipeline.totalDuration).toBeGreaterThanOrEqual(0);
      const expected =
        Date.parse(pipeline.completedAt!) - Date.parse(pipeline.createdAt);
      expect(pipeline.totalDuration).toBe(expected);
    });

    it('should merge result into metadata', async () => {
      const result = { prNumber: 123, prUrl: 'https://github.com/pr/123' };
      const pipeline = await repository.complete('task-1', result);

      expect(pipeline.metadata.prNumber).toBe(123);
      expect(pipeline.metadata.prUrl).toBe('https://github.com/pr/123');
    });

    it('should throw PipelineNotFoundError when pipeline does not exist', async () => {
      await expect(repository.complete('non-existent')).rejects.toThrow(
        PipelineNotFoundError
      );
    });
  });

  describe('fail', () => {
    beforeEach(async () => {
      await repository.init('task-1', { name: 'Test Task' });
    });

    it('should mark pipeline as failed with Error object', async () => {
      const error = new Error('Pipeline failed');
      const pipeline = await repository.fail('task-1', error);

      expect(pipeline.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.FAILED);
      expect(pipeline.failedAt).toBeDefined();
      expect(pipeline.errors).toHaveLength(1);
      expect(pipeline.errors[0].error).toBe('Pipeline failed');
    });

    it('should mark pipeline as failed with error string', async () => {
      const pipeline = await repository.fail('task-1', 'Pipeline failed');

      expect(pipeline.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline.errors[0].error).toBe('Pipeline failed');
    });

    it('should throw PipelineNotFoundError when pipeline does not exist', async () => {
      await expect(repository.fail('non-existent', 'Error')).rejects.toThrow(
        PipelineNotFoundError
      );
    });
  });

  describe('getActive', () => {
    it('should return empty array when no active pipelines', async () => {
      const active = await repository.getActive();
      expect(active).toEqual([]);
    });

    it('should return only in-progress pipelines', async () => {
      await repository.init('task-1', { name: 'Task 1' });
      await repository.init('task-2', { name: 'Task 2' });
      await repository.complete('task-2');

      const active = await repository.getActive();
      expect(active).toHaveLength(1);
      expect(active[0].taskId).toBe('task-1');
    });

    it('should not return completed pipelines', async () => {
      await repository.init('task-1', { name: 'Task 1' });
      await repository.complete('task-1');

      const active = await repository.getActive();
      expect(active).toEqual([]);
    });

    it('should not return failed pipelines', async () => {
      await repository.init('task-1', { name: 'Task 1' });
      await repository.fail('task-1', 'Error');

      const active = await repository.getActive();
      expect(active).toEqual([]);
    });
  });

  describe('getSummary', () => {
    it('should return null when pipeline does not exist', async () => {
      const summary = await repository.getSummary('non-existent');
      expect(summary).toBeNull();
    });

    it('should return pipeline summary', async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);
      await repository.completeStage('task-1', PIPELINE_STAGES.ANALYZING);

      const summary = await repository.getSummary('task-1');

      expect(summary).toBeDefined();
      expect(summary?.taskId).toBe('task-1');
      expect(summary?.taskName).toBe('Test Task');
      expect(summary?.currentStage).toBe(PIPELINE_STAGES.ANALYZING);
      expect(summary?.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(summary?.progress).toBeGreaterThan(0);
      expect(summary?.duration).toBeGreaterThanOrEqual(0);
      expect(summary?.reviewIterations).toBe(0);
      expect(summary?.hasErrors).toBe(false);
    });

    it('should calculate progress correctly', async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);
      await repository.completeStage('task-1', PIPELINE_STAGES.ANALYZING);

      const summary = await repository.getSummary('task-1');

      // 2 completed stages (detection + analyzing) out of 10 total = 20%
      expect(summary?.progress).toBe(20);
    });

    it('should indicate when pipeline has errors', async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.updateStage('task-1', PIPELINE_STAGES.ANALYZING);
      await repository.failStage('task-1', PIPELINE_STAGES.ANALYZING, 'Error');

      const summary = await repository.getSummary('task-1');

      expect(summary?.hasErrors).toBe(true);
    });

    it('should include review iterations from metadata', async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.updateMetadata('task-1', { reviewIterations: 2 });

      const summary = await repository.getSummary('task-1');

      expect(summary?.reviewIterations).toBe(2);
    });

    it('should use completedAt for duration if pipeline completed', async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.complete('task-1');

      const summary = await repository.getSummary('task-1');
      const pipeline = await repository.get('task-1');

      const expectedDuration =
        Date.parse(pipeline!.completedAt!) - Date.parse(pipeline!.createdAt);
      expect(summary?.duration).toBe(expectedDuration);
    });

    it('should use failedAt for duration if pipeline failed', async () => {
      await repository.init('task-1', { name: 'Test Task' });
      await repository.fail('task-1', 'Error');

      const summary = await repository.getSummary('task-1');
      const pipeline = await repository.get('task-1');

      const expectedDuration =
        Date.parse(pipeline!.failedAt!) - Date.parse(pipeline!.createdAt);
      expect(summary?.duration).toBe(expectedDuration);
    });
  });
});
