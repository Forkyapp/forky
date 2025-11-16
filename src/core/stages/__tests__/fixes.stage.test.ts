/**
 * Fixes Stage Tests
 * Tests Claude-powered TODO/FIXME resolution stage
 */

import { FixesStage } from '../fixes.stage';
import * as storage from '../../../../lib/storage';
import * as claude from '../../ai-services/claude.service';
import type { StageContext, FixResult } from '../types';
import type { ClickUpTask } from '@/types/clickup';
import type { PipelineData } from '@/types/storage';

// Mock dependencies
jest.mock('../../../../lib/storage');
jest.mock('../../ai-services/claude.service');

describe('FixesStage', () => {
  let stage: FixesStage;
  let mockContext: StageContext;

  beforeEach(() => {
    stage = new FixesStage();

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

    it('should execute Claude fixes successfully', async () => {
      const mockResult: FixResult = {
        success: true,
        branch: 'feature/task-123',
        issuesFixed: 5,
      };
      (claude.fixTodoComments as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(claude.fixTodoComments).toHaveBeenCalledWith(mockContext.task, {
        repoConfig: mockContext.repoConfig,
      });

      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CLAUDE_FIXING,
        { name: 'Claude Fixes' }
      );
      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CLAUDE_FIXING,
        { branch: 'feature/task-123' }
      );

      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/task-123');
      expect(result.issuesFixed).toBe(5);
    });

    it('should handle fixes with no TODOs found', async () => {
      const mockResult: FixResult = {
        success: true,
        branch: 'feature/task-123',
        issuesFixed: 0,
      };
      (claude.fixTodoComments as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.issuesFixed).toBe(0);
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

    it('should handle Claude fixes failure gracefully', async () => {
      const mockResult: FixResult = {
        success: false,
        error: 'Failed to fix TODOs',
      };
      (claude.fixTodoComments as jest.Mock).mockResolvedValue(mockResult);

      // Should NOT throw - fixes failures are non-critical
      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fix TODOs');

      // Should still record failure in pipeline
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CLAUDE_FIXING,
        expect.any(Error)
      );
      expect(storage.pipeline.completeStage).not.toHaveBeenCalled();
    });

    it('should handle Claude service throwing error', async () => {
      const error = new Error('Claude CLI not found');
      (claude.fixTodoComments as jest.Mock).mockRejectedValue(error);

      // Should NOT throw - fixes failures are non-critical
      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude CLI not found');

      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.CLAUDE_FIXING,
        error
      );
    });

    it('should continue workflow after fixes failure', async () => {
      const error = new Error('Timeout fixing TODOs');
      (claude.fixTodoComments as jest.Mock).mockRejectedValue(error);

      const result = await stage.execute(mockContext);

      // Verify we get a failed result but execution doesn't throw
      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout fixing TODOs');
    });

    it('should handle fixes failure with no error message', async () => {
      const mockResult: FixResult = {
        success: false,
      };
      (claude.fixTodoComments as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude fixes failed');
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
      ).rejects.toThrow('Implementation stage must be completed before fixes');
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
      ).rejects.toThrow('Implementation stage must be completed before fixes');
    });

    it('should handle failed implementation stage', async () => {
      const mockPipelineState: PipelineData = {
        taskId: 'task-123',
        taskName: 'Test task',
        currentStage: 'implementing',
        status: 'failed',
        stages: [
          {
            name: 'Implementation',
            stage: 'implementing',
            status: 'failed',
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
      ).rejects.toThrow('Implementation stage must be completed before fixes');
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
