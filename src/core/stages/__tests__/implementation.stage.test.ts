/**
 * Implementation Stage Tests
 */

import { ImplementationStage } from '../implementation.stage';
import * as storage from '../../../../lib/storage';
import * as claude from '../../ai-services/claude.service';
import { createMockClickUpTask } from '../../../test-setup';
import type { ImplementationStageContext } from '../types';

// Mock dependencies
jest.mock('../../../../lib/storage');
jest.mock('../../ai-services/claude.service');

describe('ImplementationStage', () => {
  let stage: ImplementationStage;
  let mockContext: ImplementationStageContext;

  beforeEach(() => {
    stage = new ImplementationStage();
    mockContext = {
      task: createMockClickUpTask({
        id: 'task-1',
        name: 'Add login feature',
        description: 'Implement user authentication',
      }),
      taskId: 'task-1',
      taskName: 'Add login feature',
      repoConfig: {
        path: '/path/to/repo',
        owner: 'test-owner',
        repo: 'test-repo',
        baseBranch: 'main',
      },
      analysis: {
        success: true,
        featureSpecFile: '/path/to/spec.md',
        content: 'Feature specification content',
        featureDir: '/path/to/feature',
      },
    };

    // Mock storage functions
    (storage.pipeline.updateStage as jest.Mock) = jest.fn();
    (storage.pipeline.completeStage as jest.Mock) = jest.fn();
    (storage.pipeline.failStage as jest.Mock) = jest.fn();

    // Suppress console output
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute Claude implementation successfully', async () => {
      const mockResult = {
        success: true,
        branch: 'feature/task-1',
        logFile: '/path/to/log',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/task-1');
      expect(claude.launchClaude).toHaveBeenCalledWith(mockContext.task, {
        analysis: {
          content: 'Feature specification content',
          featureDir: '/path/to/feature',
          featureSpecFile: '/path/to/spec.md',
        },
        repoConfig: mockContext.repoConfig,
        worktreePath: undefined,
      });
    });

    it('should update pipeline stage before execution', async () => {
      (claude.launchClaude as jest.Mock).mockResolvedValue({
        success: true,
        branch: 'feature/task-1',
      });

      await stage.execute(mockContext);

      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.IMPLEMENTING,
        { name: 'Claude Implementation' }
      );
    });

    it('should complete pipeline stage on success', async () => {
      const mockResult = {
        success: true,
        branch: 'feature/task-1',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      await stage.execute(mockContext);

      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.IMPLEMENTING,
        { branch: 'feature/task-1' }
      );
    });

    it('should work without analysis (fallback mode)', async () => {
      const contextWithoutAnalysis = {
        ...mockContext,
        analysis: null,
      };
      const mockResult = {
        success: true,
        branch: 'feature/task-1',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(contextWithoutAnalysis);

      expect(result.success).toBe(true);
      expect(claude.launchClaude).toHaveBeenCalledWith(mockContext.task, {
        analysis: undefined,
        repoConfig: mockContext.repoConfig,
        worktreePath: undefined,
      });
    });

    it('should pass worktree path when provided', async () => {
      const contextWithWorktree = {
        ...mockContext,
        worktreePath: '/path/to/worktree',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue({
        success: true,
        branch: 'feature/task-1',
      });

      await stage.execute(contextWithWorktree);

      expect(claude.launchClaude).toHaveBeenCalledWith(mockContext.task, {
        analysis: expect.any(Object),
        repoConfig: mockContext.repoConfig,
        worktreePath: '/path/to/worktree',
      });
    });

    it('should throw error when Claude implementation fails', async () => {
      (claude.launchClaude as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Implementation failed',
      });

      await expect(stage.execute(mockContext)).rejects.toThrow('Implementation failed');
    });

    it('should fail pipeline stage on error', async () => {
      const error = new Error('Implementation failed');
      (claude.launchClaude as jest.Mock).mockRejectedValue(error);

      await expect(stage.execute(mockContext)).rejects.toThrow('Implementation failed');

      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-1',
        storage.pipeline.STAGES.IMPLEMENTING,
        error
      );
    });

    it('should handle analysis without content', async () => {
      const contextWithoutContent = {
        ...mockContext,
        analysis: {
          success: true,
          featureSpecFile: '/path/to/spec.md',
        },
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue({
        success: true,
        branch: 'feature/task-1',
      });

      await stage.execute(contextWithoutContent);

      expect(claude.launchClaude).toHaveBeenCalledWith(mockContext.task, {
        analysis: undefined,
        repoConfig: mockContext.repoConfig,
        worktreePath: undefined,
      });
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

    it('should validate repository path is provided', async () => {
      const invalidContext = {
        ...mockContext,
        repoConfig: {
          ...mockContext.repoConfig,
          path: '',
        },
      };

      await expect((stage as any).validateDependencies(invalidContext)).rejects.toThrow(
        'Repository path is required for implementation'
      );
    });

    it('should validate task has name or description', async () => {
      const invalidContext = {
        ...mockContext,
        task: createMockClickUpTask({
          id: 'task-1',
          name: '',
          description: '',
        }),
      };

      await expect((stage as any).validateDependencies(invalidContext)).rejects.toThrow(
        'Task must have either a name or description for implementation'
      );
    });

    it('should accept task with name only', async () => {
      const contextWithName = {
        ...mockContext,
        task: createMockClickUpTask({
          id: 'task-1',
          name: 'Test Task',
          description: '',
        }),
      };

      await expect((stage as any).validateDependencies(contextWithName)).resolves.not.toThrow();
    });

    it('should accept task with description only', async () => {
      const contextWithDescription = {
        ...mockContext,
        task: createMockClickUpTask({
          id: 'task-1',
          name: '',
          description: 'Test Description',
        }),
      };

      await expect(
        (stage as any).validateDependencies(contextWithDescription)
      ).resolves.not.toThrow();
    });

    it('should pass validation with valid context', async () => {
      await expect((stage as any).validateDependencies(mockContext)).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle Claude service errors', async () => {
      const error = new Error('Claude service unavailable');
      (claude.launchClaude as jest.Mock).mockRejectedValue(error);

      await expect(stage.execute(mockContext)).rejects.toThrow('Claude service unavailable');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network timeout');
      (claude.launchClaude as jest.Mock).mockRejectedValue(error);

      await expect(stage.execute(mockContext)).rejects.toThrow('Network timeout');
    });

    it('should propagate errors from Claude', async () => {
      (claude.launchClaude as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Insufficient permissions',
      });

      await expect(stage.execute(mockContext)).rejects.toThrow('Insufficient permissions');
    });
  });
});
