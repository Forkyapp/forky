/**
 * Implementation Stage Tests
 * Tests Claude-powered code implementation stage
 */

import { ImplementationStage } from '../implementation.stage';
import * as storage from '../../../../lib/storage';
import * as claude from '../../ai-services/claude.service';
import type { ImplementationStageContext, ImplementationResult } from '../types';
import type { ClickUpTask } from '@/types/clickup';

// Mock dependencies
jest.mock('../../../../lib/storage');
jest.mock('../../ai-services/claude.service');

describe('ImplementationStage', () => {
  let stage: ImplementationStage;
  let mockContext: ImplementationStageContext;

  beforeEach(() => {
    stage = new ImplementationStage();

    // Create mock context
    mockContext = {
      task: {
        id: 'task-123',
        name: 'Add login feature',
        description: 'Implement user authentication',
      } as ClickUpTask,
      taskId: 'task-123',
      taskName: 'Add login feature',
      repoConfig: {
        owner: 'test-owner',
        repo: 'test-repo',
        path: '/test/repo/path',
        baseBranch: 'main',
      },
      analysis: null,
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Mock pipeline methods
    (storage.pipeline.updateStage as jest.Mock) = jest.fn();
    (storage.pipeline.completeStage as jest.Mock) = jest.fn();
    (storage.pipeline.failStage as jest.Mock) = jest.fn();
  });

  describe('execute - success cases', () => {
    it('should execute Claude implementation successfully without analysis', async () => {
      // Mock successful Claude execution
      const mockResult: ImplementationResult = {
        success: true,
        branch: 'feature/task-123',
        logFile: '/logs/claude.log',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      // Verify Claude was called correctly
      expect(claude.launchClaude).toHaveBeenCalledWith(mockContext.task, {
        analysis: undefined,
        repoConfig: mockContext.repoConfig,
      });

      // Verify pipeline updates
      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.IMPLEMENTING,
        { name: 'Claude Implementation' }
      );
      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.IMPLEMENTING,
        { branch: 'feature/task-123' }
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/task-123');
    });

    it('should execute Claude implementation with analysis', async () => {
      // Add analysis to context
      mockContext.analysis = {
        success: true,
        featureSpecFile: '/specs/feature.md',
        featureDir: '/specs',
        content: '# Feature Specification\n\nImplement authentication',
      };

      const mockResult: ImplementationResult = {
        success: true,
        branch: 'feature/task-123',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      const result = await stage.execute(mockContext);

      // Verify Claude was called with analysis
      expect(claude.launchClaude).toHaveBeenCalledWith(mockContext.task, {
        analysis: {
          content: '# Feature Specification\n\nImplement authentication',
          featureDir: '/specs',
          featureSpecFile: '/specs/feature.md',
        },
        repoConfig: mockContext.repoConfig,
      });

      expect(result.success).toBe(true);
    });

    it('should handle analysis without content', async () => {
      // Add analysis without content
      mockContext.analysis = {
        success: true,
        featureSpecFile: '/specs/feature.md',
      };

      const mockResult: ImplementationResult = {
        success: true,
        branch: 'feature/task-123',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      await stage.execute(mockContext);

      // Verify Claude was called without analysis content
      expect(claude.launchClaude).toHaveBeenCalledWith(mockContext.task, {
        analysis: undefined,
        repoConfig: mockContext.repoConfig,
      });
    });
  });

  describe('execute - failure cases', () => {
    it('should handle Claude implementation failure', async () => {
      // Mock failed Claude execution
      const mockResult: ImplementationResult = {
        success: false,
        error: 'Claude execution failed',
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      await expect(stage.execute(mockContext)).rejects.toThrow('Claude execution failed');

      // Verify pipeline was updated with failure
      expect(storage.pipeline.updateStage).toHaveBeenCalled();
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.IMPLEMENTING,
        expect.any(Error)
      );
      expect(storage.pipeline.completeStage).not.toHaveBeenCalled();
    });

    it('should handle Claude implementation error with no message', async () => {
      // Mock failed execution without error message
      const mockResult: ImplementationResult = {
        success: false,
      };
      (claude.launchClaude as jest.Mock).mockResolvedValue(mockResult);

      await expect(stage.execute(mockContext)).rejects.toThrow('Claude implementation failed');
    });

    it('should handle Claude service throwing error', async () => {
      // Mock Claude throwing an error
      const error = new Error('Claude CLI not found');
      (claude.launchClaude as jest.Mock).mockRejectedValue(error);

      await expect(stage.execute(mockContext)).rejects.toThrow('Claude CLI not found');

      // Verify pipeline failure was recorded
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'task-123',
        storage.pipeline.STAGES.IMPLEMENTING,
        error
      );
    });
  });

  describe('validateDependencies', () => {
    it('should validate repository path is required', async () => {
      const invalidContext = {
        ...mockContext,
        repoConfig: {
          ...mockContext.repoConfig,
          path: '',
        },
      };

      await expect(
        (stage as any).validateDependencies(invalidContext)
      ).rejects.toThrow('Repository path is required for implementation');
    });

    it('should require task name or description', async () => {
      const invalidContext = {
        ...mockContext,
        task: {
          id: 'task-123',
        } as ClickUpTask,
      };

      await expect(
        (stage as any).validateDependencies(invalidContext)
      ).rejects.toThrow('Task must have either a name or description for implementation');
    });

    it('should pass validation with task name only', async () => {
      const validContext = {
        ...mockContext,
        task: {
          id: 'task-123',
          name: 'Test task',
        } as ClickUpTask,
      };

      await expect((stage as any).validateDependencies(validContext)).resolves.not.toThrow();
    });

    it('should pass validation with task description only', async () => {
      const validContext = {
        ...mockContext,
        task: {
          id: 'task-123',
          description: 'Test description',
        } as ClickUpTask,
      };

      await expect((stage as any).validateDependencies(validContext)).resolves.not.toThrow();
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

    it('should require taskId', async () => {
      const invalidContext = {
        ...mockContext,
        taskId: '',
      };

      await expect(
        (stage as any).validateDependencies(invalidContext)
      ).rejects.toThrow('Task ID is required');
    });

    it('should require repoConfig', async () => {
      const invalidContext = {
        ...mockContext,
        repoConfig: null as any,
      };

      await expect(
        (stage as any).validateDependencies(invalidContext)
      ).rejects.toThrow('Repository configuration is required');
    });
  });
});
