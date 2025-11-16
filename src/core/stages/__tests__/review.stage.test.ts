/**
 * Review Stage Tests
 * Tests Codex-powered code review stage
 */

import { ReviewStage } from '../review.stage';
import * as storage from '../../../../lib/storage';
import * as codex from '../../monitoring/codex.service';
import type { StageContext, ReviewResult } from '../types';
import type { ClickUpTask } from '@/types/clickup';
import type { PipelineData } from '@/types/storage';

// Mock dependencies
jest.mock('../../../../lib/storage');
jest.mock('../../monitoring/codex.service');

describe('ReviewStage', () => {
  let stage: ReviewStage;
  let mockContext: StageContext;

  beforeEach(() => {
    stage = new ReviewStage();

    mockContext = {
      task: {
        id: 'task-123',
        name: 'Add login feature',
        description: 'Implement user authentication',
      } as ClickUpTask,
      taskId: 'task-123',
        taskName: 'Test task',
      taskName: 'Add login feature',
      repoConfig: {
        owner: 'test-owner',
        repo: 'test-repo',
        path: '/test/repo/path',
        baseBranch: 'main',
      },
    };

    jest.clearAllMocks();

    // Mock pipeline methods
    (storage.pipeline.updateStage as jest.Mock) = jest.fn();
    (storage.pipeline.completeStage as jest.Mock) = jest.fn();
    (storage.pipeline.failStage as jest.Mock) = jest.fn();
    (storage.pipeline.get as jest.Mock) = jest.fn();
  });

  describe('execute - success cases', () => {
    beforeEach(() => {
      // Mock pipeline state showing implementation completed
      const mockPipelineState: PipelineData = {
        taskId: 'task-123',
        taskName: 'Test task',
        currentStage: 'implementing',
        status: 'in_progress',
        stages: [
          {
            name: 'Implementation',
            stage: 'implementing',
            status: 'completed',
            startedAt: '2025-01-01T00:00:00Z',
            completedAt: '2025-01-01T00:05:00Z',
          },
        ],
        metadata: {},
        errors: [],
        createdAt: '2025-01-01T00:00:00Z',
        startedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:05:00Z',
      };
      (storage.pipeline.get as jest.Mock).mockReturnValue(mockPipelineState);
    });

    it('should execute Codex review successfully', async () => {
      const mockResult: ReviewResult = {
        success: true,
        branch: 'feature/task-123',
        reviewFile: '/reviews/review.md',
        issuesFound: 3,
      };
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(codex.reviewClaudeChanges).toHaveBeenCalledWith(mockContext.task, {
        repoConfig: mockContext.repoConfig,
      });

      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CODEX_REVIEWING,
        { name: 'Codex Review' }
      );
      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CODEX_REVIEWING,
        { branch: 'feature/task-123' }
      );

      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/task-123');
      expect(result.issuesFound).toBe(3);
    });

    it('should handle review with no issues found', async () => {
      const mockResult: ReviewResult = {
        success: true,
        branch: 'feature/task-123',
        issuesFound: 0,
      };
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.issuesFound).toBe(0);
    });
  });

  describe('execute - failure cases (non-critical)', () => {
    beforeEach(() => {
      // Mock pipeline state showing implementation completed
      const mockPipelineState: PipelineData = {
        taskId: 'task-123',
        taskName: 'Test task',
        currentStage: 'implementing',
        status: 'in_progress',
        stages: [
          {
            name: 'Implementation',
            stage: 'implementing',
            status: 'completed',
            startedAt: '2025-01-01T00:00:00Z',
            completedAt: '2025-01-01T00:05:00Z',
          },
        ],
        metadata: {},
        errors: [],
        createdAt: '2025-01-01T00:00:00Z',
        startedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:05:00Z',
      };
      (storage.pipeline.get as jest.Mock).mockReturnValue(mockPipelineState);
    });

    it('should handle Codex review failure gracefully', async () => {
      const mockResult: ReviewResult = {
        success: false,
        error: 'Codex review failed',
      };
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue(mockResult);

      // Should NOT throw - review failures are non-critical
      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Codex review failed');

      // Should still record failure in pipeline
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CODEX_REVIEWING,
        expect.any(Error)
      );
      expect(storage.pipeline.completeStage).not.toHaveBeenCalled();
    });

    it('should handle Codex service throwing error', async () => {
      const error = new Error('Codex CLI not found');
      (codex.reviewClaudeChanges as jest.Mock).mockRejectedValue(error);

      // Should NOT throw - review failures are non-critical
      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Codex CLI not found');

      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CODEX_REVIEWING,
        error
      );
    });

    it('should continue workflow after review failure', async () => {
      const error = new Error('Review timeout');
      (codex.reviewClaudeChanges as jest.Mock).mockRejectedValue(error);

      const result = await stage.execute(mockContext);

      // Verify we get a failed result but execution doesn't throw
      expect(result.success).toBe(false);
      expect(result.error).toBe('Review timeout');
    });
  });

  describe('validateDependencies', () => {
    it('should require pipeline state to exist', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue(null);

      await expect(
        (stage as any).validateDependencies(mockContext)
      ).rejects.toThrow('Pipeline state not found');
    });

    it('should require implementation stage to be completed', async () => {
      const mockPipelineState: PipelineData = {
        taskId: 'task-123',
        taskName: 'Test task',
        currentStage: 'implementing',
        status: 'in_progress',
        stages: [
          {
            name: 'Implementation',
            stage: 'implementing',
            status: 'in_progress', // Not completed
            startedAt: '2025-01-01T00:00:00Z',
          },
        ],
        metadata: {},
        errors: [],
        createdAt: '2025-01-01T00:00:00Z',
        startedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:05:00Z',
      };
      (storage.pipeline.get as jest.Mock).mockReturnValue(mockPipelineState);

      await expect(
        (stage as any).validateDependencies(mockContext)
      ).rejects.toThrow('Implementation stage must be completed before review');
    });

    it('should require implementation stage to exist', async () => {
      const mockPipelineState: PipelineData = {
        taskId: 'task-123',
        taskName: 'Test task',
        currentStage: 'detected',
        status: 'in_progress',
        stages: [], // No implementing stage
        metadata: {},
        errors: [],
        createdAt: '2025-01-01T00:00:00Z',
        startedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:05:00Z',
      };
      (storage.pipeline.get as jest.Mock).mockReturnValue(mockPipelineState);

      await expect(
        (stage as any).validateDependencies(mockContext)
      ).rejects.toThrow('Implementation stage must be completed before review');
    });

    it('should pass validation when implementation is completed', async () => {
      const mockPipelineState: PipelineData = {
        taskId: 'task-123',
        taskName: 'Test task',
        currentStage: 'implementing',
        status: 'in_progress',
        stages: [
          {
            name: 'Implementation',
            stage: 'implementing',
            status: 'completed',
            startedAt: '2025-01-01T00:00:00Z',
            completedAt: '2025-01-01T00:05:00Z',
          },
        ],
        metadata: {},
        errors: [],
        createdAt: '2025-01-01T00:00:00Z',
        startedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:05:00Z',
      };
      (storage.pipeline.get as jest.Mock).mockReturnValue(mockPipelineState);

      await expect(
        (stage as any).validateDependencies(mockContext)
      ).resolves.not.toThrow();
    });
  });

  describe('integration with base stage', () => {
    it('should inherit base stage validation', async () => {
      const invalidContext = {
        ...mockContext,
        task: null as any,
      };

      await expect(
        (stage as any).validateDependencies(invalidContext)
      ).rejects.toThrow('Task is required');
    });
  });
});
