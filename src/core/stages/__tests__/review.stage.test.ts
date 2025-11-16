/**
 * Review Stage Tests
 */

import { ReviewStage } from '../review.stage';
import * as storage from '../../../../lib/storage';
import * as codex from '../../monitoring/codex.service';
import { createMockClickUpTask } from '../../../test-setup';
import type { StageContext } from '../types';

// Mock dependencies
jest.mock('../../../../lib/storage');
jest.mock('../../monitoring/codex.service');

describe('ReviewStage', () => {
  let stage: ReviewStage;
  let mockContext: StageContext;

  beforeEach(() => {
    stage = new ReviewStage();
    mockContext = {
      task: createMockClickUpTask({
        id: 'task-1',
        name: 'Add login feature',
      }),
      taskId: 'task-1',
      taskName: 'Add login feature',
      repoConfig: {
        path: '/path/to/repo',
        owner: 'test-owner',
        repo: 'test-repo',
        baseBranch: 'main',
      },
    };

    // Mock storage functions
    (storage.pipeline.updateStage as jest.Mock) = jest.fn();
    (storage.pipeline.completeStage as jest.Mock) = jest.fn();
    (storage.pipeline.failStage as jest.Mock) = jest.fn();
    (storage.pipeline.get as jest.Mock) = jest.fn().mockReturnValue({
      taskId: 'task-1',
      stages: [
        {
          stage: 'implementing',
          status: 'completed',
        },
      ],
    });

    // Suppress console output
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute Codex review successfully', async () => {
      const mockResult = {
        success: true,
        branch: 'feature/task-1',
        hasComments: true,
      };
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/task-1');
      expect(codex.reviewClaudeChanges).toHaveBeenCalledWith(mockContext.task, {
        repoConfig: mockContext.repoConfig,
      });
    });

    it('should update pipeline stage before execution', async () => {
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue({
        success: true,
        branch: 'feature/task-1',
      });

      await stage.execute(mockContext);

      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.CODEX_REVIEWING,
        { name: 'Codex Review' }
      );
    });

    it('should complete pipeline stage on success', async () => {
      const mockResult = {
        success: true,
        branch: 'feature/task-1',
      };
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue(mockResult);

      await stage.execute(mockContext);

      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.CODEX_REVIEWING,
        { branch: 'feature/task-1' }
      );
    });

    it('should handle review failure gracefully', async () => {
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Review failed',
      });

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Review failed');
      expect(storage.pipeline.failStage).toHaveBeenCalled();
    });

    it('should continue workflow on review failure', async () => {
      (codex.reviewClaudeChanges as jest.Mock).mockRejectedValue(
        new Error('Codex unavailable')
      );

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Codex unavailable');
    });

    it('should fail pipeline stage on error', async () => {
      const error = new Error('Network error');
      (codex.reviewClaudeChanges as jest.Mock).mockRejectedValue(error);

      await stage.execute(mockContext);

      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.CODEX_REVIEWING,
        error
      );
    });
  });

  describe('validateDependencies', () => {
    it('should validate base dependencies', async () => {
      const invalidContext = {
        ...mockContext,
        task: null as any,
      };

      await expect((stage as any).validateDependencies(invalidContext)).rejects.toThrow(
        'Task is required'
      );
    });

    it('should validate pipeline state exists', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue(null);

      await expect((stage as any).validateDependencies(mockContext)).rejects.toThrow(
        'Pipeline state not found'
      );
    });

    it('should validate implementation stage completed', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue({
        taskId: 'task-1',
        stages: [
          {
            stage: 'implementing',
            status: 'in_progress',
          },
        ],
      });

      await expect((stage as any).validateDependencies(mockContext)).rejects.toThrow(
        'Implementation stage must be completed before review'
      );
    });

    it('should validate implementation stage exists', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue({
        taskId: 'task-1',
        stages: [],
      });

      await expect((stage as any).validateDependencies(mockContext)).rejects.toThrow(
        'Implementation stage must be completed before review'
      );
    });

    it('should pass validation when implementation completed', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue({
        taskId: 'task-1',
        stages: [
          {
            stage: 'implementing',
            status: 'completed',
          },
        ],
      });

      await expect((stage as any).validateDependencies(mockContext)).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle Codex service errors', async () => {
      const error = new Error('Codex service unavailable');
      (codex.reviewClaudeChanges as jest.Mock).mockRejectedValue(error);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Codex service unavailable');
    });

    it('should not throw on review failures', async () => {
      (codex.reviewClaudeChanges as jest.Mock).mockRejectedValue(
        new Error('Review failed')
      );

      await expect(stage.execute(mockContext)).resolves.toBeDefined();
    });

    it('should return error result instead of throwing', async () => {
      (codex.reviewClaudeChanges as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Invalid branch',
      });

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid branch');
    });
  });
});
