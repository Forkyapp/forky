/**
 * Fixes Stage Tests
 */

import { FixesStage } from '../fixes.stage';
import * as storage from '../../../../lib/storage';
import * as claude from '../../ai-services/claude.service';
import { createMockClickUpTask } from '../../../test-setup';
import type { StageContext } from '../types';

// Mock dependencies
jest.mock('../../../../lib/storage');
jest.mock('../../ai-services/claude.service');

describe('FixesStage', () => {
  let stage: FixesStage;
  let mockContext: StageContext;

  beforeEach(() => {
    stage = new FixesStage();
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
    it('should execute Claude fixes successfully', async () => {
      const mockResult = {
        success: true,
        branch: 'feature/task-1',
        fixedCount: 5,
      };
      (claude.fixTodoComments as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/task-1');
      expect(claude.fixTodoComments).toHaveBeenCalledWith(mockContext.task, {
        repoConfig: mockContext.repoConfig,
        worktreePath: undefined,
      });
    });

    it('should update pipeline stage before execution', async () => {
      (claude.fixTodoComments as jest.Mock).mockResolvedValue({
        success: true,
        branch: 'feature/task-1',
      });

      await stage.execute(mockContext);

      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.CLAUDE_FIXING,
        { name: 'Claude Fixes' }
      );
    });

    it('should complete pipeline stage on success', async () => {
      const mockResult = {
        success: true,
        branch: 'feature/task-1',
      };
      (claude.fixTodoComments as jest.Mock).mockResolvedValue(mockResult);

      await stage.execute(mockContext);

      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.CLAUDE_FIXING,
        { branch: 'feature/task-1' }
      );
    });

    it('should pass worktree path when provided', async () => {
      const contextWithWorktree = {
        ...mockContext,
        worktreePath: '/path/to/worktree',
      };
      (claude.fixTodoComments as jest.Mock).mockResolvedValue({
        success: true,
        branch: 'feature/task-1',
      });

      await stage.execute(contextWithWorktree);

      expect(claude.fixTodoComments).toHaveBeenCalledWith(mockContext.task, {
        repoConfig: mockContext.repoConfig,
        worktreePath: '/path/to/worktree',
      });
    });

    it('should handle fixes failure gracefully', async () => {
      (claude.fixTodoComments as jest.Mock).mockResolvedValue({
        success: false,
        error: 'No TODOs found',
      });

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No TODOs found');
      expect(storage.pipeline.failStage).toHaveBeenCalled();
    });

    it('should continue workflow on fixes failure', async () => {
      (claude.fixTodoComments as jest.Mock).mockRejectedValue(
        new Error('Claude unavailable')
      );

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude unavailable');
    });

    it('should fail pipeline stage on error', async () => {
      const error = new Error('Network error');
      (claude.fixTodoComments as jest.Mock).mockRejectedValue(error);

      await stage.execute(mockContext);

      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.CLAUDE_FIXING,
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
        'Implementation stage must be completed before fixes'
      );
    });

    it('should validate implementation stage exists', async () => {
      (storage.pipeline.get as jest.Mock).mockReturnValue({
        taskId: 'task-1',
        stages: [],
      });

      await expect((stage as any).validateDependencies(mockContext)).rejects.toThrow(
        'Implementation stage must be completed before fixes'
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
    it('should handle Claude service errors', async () => {
      const error = new Error('Claude service unavailable');
      (claude.fixTodoComments as jest.Mock).mockRejectedValue(error);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude service unavailable');
    });

    it('should not throw on fixes failures', async () => {
      (claude.fixTodoComments as jest.Mock).mockRejectedValue(new Error('Fixes failed'));

      await expect(stage.execute(mockContext)).resolves.toBeDefined();
    });

    it('should return error result instead of throwing', async () => {
      (claude.fixTodoComments as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Invalid branch',
      });

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid branch');
    });
  });
});
