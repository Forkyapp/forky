/**
 * Pipeline Repository Tests
 * Tests pipeline state management and progress tracking
 */

import fs from 'fs';
import { PipelineRepository } from '../pipeline.repository';
import { FileReadError, FileWriteError, PipelineNotFoundError } from '@/shared/errors';
import { PIPELINE_STAGES, PIPELINE_STATUS } from '@/shared/constants';
import { createTempDir, cleanupTempDir } from '../../../test-setup';
import type { PipelineData } from '@/types/storage';

describe('PipelineRepository', () => {
  let tempDir: string;
  let filePath: string;
  let repo: PipelineRepository;

  beforeEach(() => {
    tempDir = createTempDir('pipeline-repo-test');
    filePath = `${tempDir}/pipeline-state.json`;
    repo = new PipelineRepository(filePath);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('load', () => {
    it('should return empty object when file does not exist', async () => {
      const result = await repo.load();
      expect(result).toEqual({});
    });

    it('should load existing pipeline data', async () => {
      const testData = {
        'task-123': {
          taskId: 'task-123',
          taskName: 'Test task',
          currentStage: PIPELINE_STAGES.IMPLEMENTING,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:05:00Z',
          stages: [],
          metadata: {},
          errors: [],
        },
      };

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
    it('should save pipeline data to file', async () => {
      const testData = {
        'task-123': {
          taskId: 'task-123',
          taskName: 'Test task',
          currentStage: PIPELINE_STAGES.DETECTED,
          status: PIPELINE_STATUS.IN_PROGRESS,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          stages: [],
          metadata: {},
          errors: [],
        },
      };

      await repo.save(testData);

      const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(savedData).toEqual(testData);
    });

    it('should throw FileWriteError on write failure', async () => {
      const invalidRepo = new PipelineRepository('/nonexistent/directory/file.json');

      await expect(invalidRepo.save({})).rejects.toThrow(FileWriteError);
    });
  });

  describe('get', () => {
    it('should return null for non-existent task', async () => {
      const result = await repo.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return pipeline for existing task', async () => {
      const pipeline = await repo.init('task-123', { name: 'Test task' });

      const result = await repo.get('task-123');
      expect(result).toEqual(pipeline);
      expect(result?.taskId).toBe('task-123');
    });
  });

  describe('init', () => {
    it('should initialize new pipeline with default values', async () => {
      const pipeline = await repo.init('task-123');

      expect(pipeline.taskId).toBe('task-123');
      expect(pipeline.taskName).toBe('');
      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.DETECTED);
      expect(pipeline.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(pipeline.stages).toHaveLength(1);
      expect(pipeline.stages[0].stage).toBe(PIPELINE_STAGES.DETECTED);
      expect(pipeline.stages[0].status).toBe(PIPELINE_STATUS.COMPLETED);
      expect(pipeline.metadata).toBeDefined();
      expect(pipeline.errors).toEqual([]);
    });

    it('should initialize pipeline with task data', async () => {
      const taskData = {
        name: 'Add login feature',
        title: 'Login Feature',
      };

      const pipeline = await repo.init('task-123', taskData);

      expect(pipeline.taskName).toBe('Add login feature');
    });

    it('should use title if name is not provided', async () => {
      const taskData = {
        title: 'Login Feature',
      };

      const pipeline = await repo.init('task-123', taskData);

      expect(pipeline.taskName).toBe('Login Feature');
    });

    it('should initialize metadata structure', async () => {
      const pipeline = await repo.init('task-123');

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

    it('should persist pipeline to file', async () => {
      await repo.init('task-123', { name: 'Test' });

      const pipelines = await repo.load();
      expect(pipelines['task-123']).toBeDefined();
    });
  });

  describe('updateStage', () => {
    beforeEach(async () => {
      await repo.init('task-123', { name: 'Test task' });
    });

    it('should create new stage if it does not exist', async () => {
      const pipeline = await repo.updateStage('task-123', PIPELINE_STAGES.IMPLEMENTING, {
        name: 'Claude Implementation',
      });

      const implementingStage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage).toBeDefined();
      expect(implementingStage?.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(implementingStage?.name).toBe('Claude Implementation');
      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.IMPLEMENTING);
    });

    it('should update existing stage', async () => {
      await repo.updateStage('task-123', PIPELINE_STAGES.ANALYZING);
      const pipeline = await repo.updateStage('task-123', PIPELINE_STAGES.ANALYZING, {
        name: 'Gemini Analysis v2',
      });

      const analyzingStage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.ANALYZING);
      expect(analyzingStage?.name).toBe('Gemini Analysis v2');
    });

    it('should throw PipelineNotFoundError for non-existent pipeline', async () => {
      await expect(
        repo.updateStage('non-existent', PIPELINE_STAGES.IMPLEMENTING)
      ).rejects.toThrow(PipelineNotFoundError);
    });

    it('should update pipeline updatedAt timestamp', async () => {
      const before = await repo.get('task-123');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const after = await repo.updateStage('task-123', PIPELINE_STAGES.IMPLEMENTING);

      expect(after.updatedAt).not.toBe(before?.updatedAt);
    });
  });

  describe('completeStage', () => {
    beforeEach(async () => {
      await repo.init('task-123');
      await repo.updateStage('task-123', PIPELINE_STAGES.IMPLEMENTING);
    });

    it('should mark stage as completed', async () => {
      const pipeline = await repo.completeStage('task-123', PIPELINE_STAGES.IMPLEMENTING);

      const implementingStage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage?.status).toBe(PIPELINE_STATUS.COMPLETED);
      expect(implementingStage?.completedAt).toBeDefined();
    });

    it('should calculate stage duration', async () => {
      const pipeline = await repo.completeStage('task-123', PIPELINE_STAGES.IMPLEMENTING);

      const implementingStage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should merge result data into stage', async () => {
      const result = {
        branch: 'feature/task-123',
        logFile: '/logs/claude.log',
      };

      const pipeline = await repo.completeStage('task-123', PIPELINE_STAGES.IMPLEMENTING, result);

      const implementingStage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage).toMatchObject(result);
    });

    it('should throw PipelineNotFoundError for non-existent pipeline', async () => {
      await expect(
        repo.completeStage('non-existent', PIPELINE_STAGES.IMPLEMENTING)
      ).rejects.toThrow(PipelineNotFoundError);
    });
  });

  describe('failStage', () => {
    beforeEach(async () => {
      await repo.init('task-123');
      await repo.updateStage('task-123', PIPELINE_STAGES.IMPLEMENTING);
    });

    it('should mark stage as failed with error message', async () => {
      const error = new Error('Implementation failed');
      const pipeline = await repo.failStage('task-123', PIPELINE_STAGES.IMPLEMENTING, error);

      const implementingStage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage?.status).toBe(PIPELINE_STATUS.FAILED);
      expect(implementingStage?.error).toBe('Implementation failed');
      expect(implementingStage?.completedAt).toBeDefined();
    });

    it('should handle string error', async () => {
      const pipeline = await repo.failStage('task-123', PIPELINE_STAGES.IMPLEMENTING, 'String error');

      const implementingStage = pipeline.stages.find((s) => s.stage === PIPELINE_STAGES.IMPLEMENTING);
      expect(implementingStage?.error).toBe('String error');
    });

    it('should append error to pipeline errors array', async () => {
      await repo.failStage('task-123', PIPELINE_STAGES.IMPLEMENTING, 'Test error');

      const pipeline = await repo.get('task-123');
      expect(pipeline?.errors).toHaveLength(1);
      expect(pipeline?.errors[0].stage).toBe(PIPELINE_STAGES.IMPLEMENTING);
      expect(pipeline?.errors[0].error).toBe('Test error');
      expect(pipeline?.errors[0].timestamp).toBeDefined();
    });

    it('should accumulate multiple errors', async () => {
      await repo.failStage('task-123', PIPELINE_STAGES.IMPLEMENTING, 'Error 1');
      await repo.updateStage('task-123', PIPELINE_STAGES.CODEX_REVIEWING);
      await repo.failStage('task-123', PIPELINE_STAGES.CODEX_REVIEWING, 'Error 2');

      const pipeline = await repo.get('task-123');
      expect(pipeline?.errors).toHaveLength(2);
    });

    it('should throw PipelineNotFoundError for non-existent pipeline', async () => {
      await expect(
        repo.failStage('non-existent', PIPELINE_STAGES.IMPLEMENTING, 'error')
      ).rejects.toThrow(PipelineNotFoundError);
    });
  });

  describe('updateMetadata', () => {
    beforeEach(async () => {
      await repo.init('task-123');
    });

    it('should update pipeline metadata', async () => {
      const metadata = {
        prNumber: 42,
        branches: ['feature/task-123'],
      };

      const pipeline = await repo.updateMetadata('task-123', metadata);

      expect(pipeline.metadata.prNumber).toBe(42);
      expect(pipeline.metadata.branches).toEqual(['feature/task-123']);
    });

    it('should merge with existing metadata', async () => {
      await repo.updateMetadata('task-123', { prNumber: 42 });
      const pipeline = await repo.updateMetadata('task-123', { reviewIterations: 1 });

      expect(pipeline.metadata.prNumber).toBe(42);
      expect(pipeline.metadata.reviewIterations).toBe(1);
    });

    it('should throw PipelineNotFoundError for non-existent pipeline', async () => {
      await expect(
        repo.updateMetadata('non-existent', {})
      ).rejects.toThrow(PipelineNotFoundError);
    });
  });

  describe('complete', () => {
    beforeEach(async () => {
      await repo.init('task-123');
    });

    it('should mark pipeline as completed', async () => {
      const pipeline = await repo.complete('task-123');

      expect(pipeline.status).toBe(PIPELINE_STATUS.COMPLETED);
      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.COMPLETED);
      expect(pipeline.completedAt).toBeDefined();
    });

    it('should calculate total duration', async () => {
      const pipeline = await repo.complete('task-123');

      expect(pipeline.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should merge result into metadata', async () => {
      const result = {
        prUrl: 'https://github.com/owner/repo/pull/42',
        prNumber: 42,
      };

      const pipeline = await repo.complete('task-123', result);

      expect(pipeline.metadata.prUrl).toBe('https://github.com/owner/repo/pull/42');
      expect(pipeline.metadata.prNumber).toBe(42);
    });

    it('should throw PipelineNotFoundError for non-existent pipeline', async () => {
      await expect(repo.complete('non-existent')).rejects.toThrow(PipelineNotFoundError);
    });
  });

  describe('fail', () => {
    beforeEach(async () => {
      await repo.init('task-123');
    });

    it('should mark pipeline as failed', async () => {
      const pipeline = await repo.fail('task-123', 'Critical error');

      expect(pipeline.status).toBe(PIPELINE_STATUS.FAILED);
      expect(pipeline.currentStage).toBe(PIPELINE_STAGES.FAILED);
      expect(pipeline.failedAt).toBeDefined();
    });

    it('should append error to errors array', async () => {
      await repo.fail('task-123', new Error('Pipeline failed'));

      const pipeline = await repo.get('task-123');
      expect(pipeline?.errors).toHaveLength(1);
      expect(pipeline?.errors[0].error).toBe('Pipeline failed');
    });

    it('should throw PipelineNotFoundError for non-existent pipeline', async () => {
      await expect(repo.fail('non-existent', 'error')).rejects.toThrow(PipelineNotFoundError);
    });
  });

  describe('getActive', () => {
    it('should return only in-progress pipelines', async () => {
      await repo.init('task-1');
      await repo.init('task-2');
      await repo.init('task-3');

      await repo.complete('task-1');
      await repo.fail('task-3', 'error');

      const active = await repo.getActive();

      expect(active).toHaveLength(1);
      expect(active[0].taskId).toBe('task-2');
    });

    it('should return empty array when no active pipelines', async () => {
      await repo.init('task-1');
      await repo.complete('task-1');

      const active = await repo.getActive();
      expect(active).toEqual([]);
    });
  });

  describe('getSummary', () => {
    it('should return null for non-existent pipeline', async () => {
      const summary = await repo.getSummary('non-existent');
      expect(summary).toBeNull();
    });

    it('should generate pipeline summary', async () => {
      await repo.init('task-123', { name: 'Test task' });
      await repo.updateStage('task-123', PIPELINE_STAGES.ANALYZING);
      await repo.completeStage('task-123', PIPELINE_STAGES.ANALYZING);

      const summary = await repo.getSummary('task-123');

      expect(summary).toBeDefined();
      expect(summary?.taskId).toBe('task-123');
      expect(summary?.taskName).toBe('Test task');
      expect(summary?.currentStage).toBe(PIPELINE_STAGES.ANALYZING);
      expect(summary?.status).toBe(PIPELINE_STATUS.IN_PROGRESS);
      expect(summary?.progress).toBeGreaterThan(0);
      expect(summary?.duration).toBeGreaterThanOrEqual(0);
      expect(summary?.reviewIterations).toBe(0);
    });

    it('should calculate progress based on completed stages', async () => {
      await repo.init('task-123');

      const summary = await repo.getSummary('task-123');
      // 1 completed stage (detected) out of 10 total stages = 10%
      expect(summary?.progress).toBe(10);
    });

    it('should indicate presence of errors', async () => {
      await repo.init('task-123');
      await repo.updateStage('task-123', PIPELINE_STAGES.IMPLEMENTING);
      await repo.failStage('task-123', PIPELINE_STAGES.IMPLEMENTING, 'error');

      const summary = await repo.getSummary('task-123');
      expect(summary?.hasErrors).toBe(true);
    });

    it('should calculate duration for completed pipeline', async () => {
      await repo.init('task-123');
      await repo.complete('task-123');

      const summary = await repo.getSummary('task-123');
      expect(summary?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate duration for failed pipeline', async () => {
      await repo.init('task-123');
      await repo.fail('task-123', 'error');

      const summary = await repo.getSummary('task-123');
      expect(summary?.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent pipeline initialization', async () => {
      const promises = [
        repo.init('task-1', { name: 'Task 1' }),
        repo.init('task-2', { name: 'Task 2' }),
        repo.init('task-3', { name: 'Task 3' }),
      ];

      const pipelines = await Promise.all(promises);

      expect(pipelines).toHaveLength(3);
      expect(pipelines[0].taskId).toBe('task-1');
      expect(pipelines[1].taskId).toBe('task-2');
      expect(pipelines[2].taskId).toBe('task-3');
    });
  });

  describe('data persistence', () => {
    it('should persist changes across repository instances', async () => {
      await repo.init('task-123', { name: 'Test' });
      await repo.updateStage('task-123', PIPELINE_STAGES.IMPLEMENTING);

      // Create new repository instance with same file
      const newRepo = new PipelineRepository(filePath);
      const pipeline = await newRepo.get('task-123');

      expect(pipeline?.currentStage).toBe(PIPELINE_STAGES.IMPLEMENTING);
    });
  });
});
