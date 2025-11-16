/**
 * Task Orchestrator Tests
 * Tests for the main workflow orchestration logic
 */

import { TaskOrchestrator } from '../orchestrator';
import { WorkflowExecutor } from '../workflow-executor';
import { ReviewStage, FixesStage } from '../../stages';
import { notificationManager } from '../../notifications';
import * as storage from '../../../../lib/storage';
import * as clickup from '../../../../lib/clickup';
import * as config from '../../../shared/config';
import { createMockClickUpTask, suppressConsole } from '../../../test-setup';
import type { ProcessTaskResult, RerunResult } from '../types';

// Mock all dependencies
jest.mock('../workflow-executor');
jest.mock('../../stages');
jest.mock('../../notifications');
jest.mock('../../../../lib/storage');
jest.mock('../../../../lib/clickup');
jest.mock('../../../shared/config');

// Suppress console output during tests
suppressConsole();

describe('TaskOrchestrator', () => {
  let orchestrator: TaskOrchestrator;
  let mockWorkflowExecutor: jest.Mocked<WorkflowExecutor>;
  let mockReviewStage: jest.Mocked<ReviewStage>;
  let mockFixesStage: jest.Mocked<FixesStage>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock instances
    mockWorkflowExecutor = {
      execute: jest.fn(),
    } as any;

    mockReviewStage = {
      run: jest.fn(),
    } as any;

    mockFixesStage = {
      run: jest.fn(),
    } as any;

    // Mock constructors to return our mocks
    (WorkflowExecutor as jest.Mock).mockImplementation(() => mockWorkflowExecutor);
    (ReviewStage as jest.Mock).mockImplementation(() => mockReviewStage);
    (FixesStage as jest.Mock).mockImplementation(() => mockFixesStage);

    // Setup default storage mocks
    (storage.pipeline.init as jest.Mock).mockReturnValue({
      taskId: 'test-task-123',
      taskName: 'Test Task',
      currentStage: 'detected',
      status: 'in_progress',
      stages: [],
      metadata: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    (storage.pipeline.get as jest.Mock).mockReturnValue({
      taskId: 'test-task-123',
      taskName: 'Test Task',
      currentStage: 'implemented',
      status: 'in_progress',
      stages: [
        {
          stage: 'implementing',
          status: 'completed',
          branch: 'task-test-task-123',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      ],
      metadata: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    (storage.pipeline.updateMetadata as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.complete as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.fail as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.updateStage as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.completeStage as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.failStage as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.getSummary as jest.Mock).mockReturnValue(null);
    (storage.pipeline.getActive as jest.Mock).mockReturnValue([]);
    (storage.queue.add as jest.Mock).mockResolvedValue({ success: true });

    // Setup default clickup mocks
    (clickup.detectRepository as jest.Mock).mockReturnValue('test-repo');

    // Setup default config mocks
    (config.resolveRepoConfig as jest.Mock).mockReturnValue({
      owner: 'test-owner',
      repo: 'test-repo',
      path: '/test/repo/path',
      baseBranch: 'main',
    });

    // Setup default notification mocks
    (notificationManager.notifyWorkflowComplete as jest.Mock).mockResolvedValue(undefined);
    (notificationManager.notifyWorkflowFailed as jest.Mock).mockResolvedValue(undefined);
    (notificationManager.notifyRerunComplete as jest.Mock).mockResolvedValue(undefined);
    (notificationManager.notifyRerunFailed as jest.Mock).mockResolvedValue(undefined);

    // Create fresh orchestrator instance
    orchestrator = new TaskOrchestrator();
  });

  describe('processTask', () => {
    it('should successfully process a task through full workflow', async () => {
      const task = createMockClickUpTask({
        id: 'test-task-123',
        name: 'Implement new feature',
      });

      // Mock successful workflow execution
      mockWorkflowExecutor.execute.mockResolvedValue({
        success: true,
        analysis: null,
      });

      const result = await orchestrator.processTask(task);

      // Verify workflow executed
      expect(mockWorkflowExecutor.execute).toHaveBeenCalledWith(task);

      // Verify pipeline initialized
      expect(storage.pipeline.init).toHaveBeenCalledWith('test-task-123', {
        name: 'Implement new feature',
      });

      // Verify repository detected
      expect(clickup.detectRepository).toHaveBeenCalledWith(task);

      // Verify pipeline completed
      expect(storage.pipeline.complete).toHaveBeenCalledWith(
        'test-task-123',
        expect.objectContaining({
          branch: 'task-test-task-123',
        })
      );

      // Verify success notification sent
      expect(notificationManager.notifyWorkflowComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'test-task-123',
          status: 'completed',
        })
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.pipeline).toBeDefined();
    });

    it('should handle repository configuration errors', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      // Mock config error
      (config.resolveRepoConfig as jest.Mock).mockImplementation(() => {
        throw new Error('Repository not configured');
      });

      const result = await orchestrator.processTask(task);

      // Verify workflow not executed
      expect(mockWorkflowExecutor.execute).not.toHaveBeenCalled();

      // Verify pipeline failed
      expect(storage.pipeline.fail).toHaveBeenCalledWith(
        'test-task-123',
        expect.any(Error)
      );

      // Verify task queued for manual processing
      expect(storage.queue.add).toHaveBeenCalledWith(task);

      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository not configured');
    });

    it('should handle workflow execution failure', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      // Mock workflow failure
      mockWorkflowExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Implementation failed',
      });

      const result = await orchestrator.processTask(task);

      // Verify pipeline failed
      expect(storage.pipeline.fail).toHaveBeenCalledWith(
        'test-task-123',
        expect.any(Error)
      );

      // Verify task queued
      expect(storage.queue.add).toHaveBeenCalledWith(task);

      // Verify failure notification sent
      expect(notificationManager.notifyWorkflowFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'test-task-123',
          status: 'failed',
          error: 'Implementation failed',
        })
      );

      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Implementation failed');
    });

    it('should handle workflow execution exception', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      // Mock workflow exception
      const error = new Error('Unexpected error');
      mockWorkflowExecutor.execute.mockRejectedValue(error);

      const result = await orchestrator.processTask(task);

      // Verify pipeline failed
      expect(storage.pipeline.fail).toHaveBeenCalledWith('test-task-123', error);

      // Verify task queued
      expect(storage.queue.add).toHaveBeenCalledWith(task);

      // Verify failure notification sent
      expect(notificationManager.notifyWorkflowFailed).toHaveBeenCalled();

      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should update metadata with detected repository', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      (clickup.detectRepository as jest.Mock).mockReturnValue('custom-repo');

      mockWorkflowExecutor.execute.mockResolvedValue({
        success: true,
        analysis: null,
      });

      await orchestrator.processTask(task);

      // Verify metadata updated with repository
      expect(storage.pipeline.updateMetadata).toHaveBeenCalledWith('test-task-123', {
        repository: 'custom-repo',
      });
    });

    it('should warn when task repo differs from active project', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      // Task specifies different repo than active project
      (clickup.detectRepository as jest.Mock).mockReturnValue('other-repo');
      (config.resolveRepoConfig as jest.Mock).mockReturnValue({
        owner: 'test-owner',
        repo: 'test-repo',
        path: '/test/repo/path',
        baseBranch: 'main',
      });

      mockWorkflowExecutor.execute.mockResolvedValue({
        success: true,
        analysis: null,
      });

      const result = await orchestrator.processTask(task);

      // Should still succeed and use active project config
      expect(result.success).toBe(true);
      expect(mockWorkflowExecutor.execute).toHaveBeenCalledWith(task);
    });
  });

  describe('rerunCodexReview', () => {
    it('should successfully rerun Codex review stage', async () => {
      const taskId = 'test-task-123';

      // Mock successful review
      mockReviewStage.run.mockResolvedValue({
        success: true,
      });

      const result = await orchestrator.rerunCodexReview(taskId);

      // Verify pipeline stage updated
      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        taskId,
        storage.pipeline.STAGES.CODEX_REVIEWING,
        expect.objectContaining({
          name: 'Codex Review (Re-run)',
        })
      );

      // Verify review stage executed
      expect(mockReviewStage.run).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          repoConfig: expect.any(Object),
        })
      );

      // Verify success notification sent
      expect(notificationManager.notifyRerunComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          stage: 'codex_review',
          status: 'completed',
        })
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.branch).toBe('task-test-task-123');
    });

    it('should fail when task not found in pipeline', async () => {
      const taskId = 'non-existent-task';

      (storage.pipeline.get as jest.Mock).mockReturnValue(null);

      const result = await orchestrator.rerunCodexReview(taskId);

      // Verify review not executed
      expect(mockReviewStage.run).not.toHaveBeenCalled();

      // Verify failure notification sent
      expect(notificationManager.notifyRerunFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          stage: 'codex_review',
          status: 'failed',
        })
      );

      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when implementation stage not completed', async () => {
      const taskId = 'test-task-123';

      // Mock pipeline without completed implementation
      (storage.pipeline.get as jest.Mock).mockReturnValue({
        taskId,
        taskName: 'Test Task',
        stages: [
          {
            stage: 'implementing',
            status: 'in_progress', // Not completed
          },
        ],
      });

      const result = await orchestrator.rerunCodexReview(taskId);

      // Verify review not executed
      expect(mockReviewStage.run).not.toHaveBeenCalled();

      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toContain('implementation stage not completed');
    });

    it('should handle review stage failure', async () => {
      const taskId = 'test-task-123';

      // Mock review failure
      mockReviewStage.run.mockResolvedValue({
        success: false,
      });

      const result = await orchestrator.rerunCodexReview(taskId);

      // Verify pipeline stage failed
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        taskId,
        storage.pipeline.STAGES.CODEX_REVIEWING,
        expect.any(Error)
      );

      // Verify failure notification sent
      expect(notificationManager.notifyRerunFailed).toHaveBeenCalled();

      // Verify result
      expect(result.success).toBe(false);
    });

    it('should handle review stage exception', async () => {
      const taskId = 'test-task-123';

      // Mock review exception
      const error = new Error('Review crashed');
      mockReviewStage.run.mockRejectedValue(error);

      const result = await orchestrator.rerunCodexReview(taskId);

      // Verify pipeline stage failed
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        taskId,
        storage.pipeline.STAGES.CODEX_REVIEWING,
        error
      );

      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Review crashed');
    });
  });

  describe('rerunClaudeFixes', () => {
    it('should successfully rerun Claude fixes stage', async () => {
      const taskId = 'test-task-123';

      // Mock successful fixes
      mockFixesStage.run.mockResolvedValue({
        success: true,
        branch: 'task-test-task-123',
      });

      const result = await orchestrator.rerunClaudeFixes(taskId);

      // Verify pipeline stage updated
      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        taskId,
        storage.pipeline.STAGES.CLAUDE_FIXING,
        expect.objectContaining({
          name: 'Claude Fixes (Re-run)',
        })
      );

      // Verify fixes stage executed
      expect(mockFixesStage.run).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          repoConfig: expect.any(Object),
        })
      );

      // Verify success notification sent
      expect(notificationManager.notifyRerunComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          stage: 'claude_fixes',
          status: 'completed',
        })
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.branch).toBe('task-test-task-123');
    });

    it('should fail when task not found in pipeline', async () => {
      const taskId = 'non-existent-task';

      (storage.pipeline.get as jest.Mock).mockReturnValue(null);

      const result = await orchestrator.rerunClaudeFixes(taskId);

      // Verify fixes not executed
      expect(mockFixesStage.run).not.toHaveBeenCalled();

      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle fixes stage failure', async () => {
      const taskId = 'test-task-123';

      // Mock fixes failure
      mockFixesStage.run.mockResolvedValue({
        success: false,
      });

      const result = await orchestrator.rerunClaudeFixes(taskId);

      // Verify pipeline stage failed
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        taskId,
        storage.pipeline.STAGES.CLAUDE_FIXING,
        expect.any(Error)
      );

      // Verify result
      expect(result.success).toBe(false);
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status summary', () => {
      const taskId = 'test-task-123';
      const mockSummary = {
        taskId,
        taskName: 'Test Task',
        currentStage: 'implementing',
        status: 'in_progress',
      };

      (storage.pipeline.getSummary as jest.Mock).mockReturnValue(mockSummary);

      const result = orchestrator.getTaskStatus(taskId);

      expect(storage.pipeline.getSummary).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockSummary);
    });

    it('should return null when task not found', () => {
      const taskId = 'non-existent-task';

      (storage.pipeline.getSummary as jest.Mock).mockReturnValue(null);

      const result = orchestrator.getTaskStatus(taskId);

      expect(result).toBeNull();
    });
  });

  describe('getActiveTasks', () => {
    it('should return all active tasks', () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          taskName: 'Task 1',
          currentStage: 'implementing',
          status: 'in_progress',
        },
        {
          taskId: 'task-2',
          taskName: 'Task 2',
          currentStage: 'analyzing',
          status: 'in_progress',
        },
      ];

      (storage.pipeline.getActive as jest.Mock).mockReturnValue(mockTasks);

      const result = orchestrator.getActiveTasks();

      expect(storage.pipeline.getActive).toHaveBeenCalled();
      expect(result).toEqual(mockTasks);
    });

    it('should return empty array when no active tasks', () => {
      (storage.pipeline.getActive as jest.Mock).mockReturnValue([]);

      const result = orchestrator.getActiveTasks();

      expect(result).toEqual([]);
    });
  });
});
