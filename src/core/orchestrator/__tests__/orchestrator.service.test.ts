/**
 * Orchestrator Service Tests
 * Tests for the legacy orchestrator wrapper that delegates to workflow system
 */

import * as orchestratorService from '../orchestrator.service';
import { taskOrchestrator } from '../../workflow';
import * as storage from '../../../../lib/storage';
import { createMockClickUpTask, suppressConsole } from '../../../test-setup';
import type { ClickUpTask } from '../../../../lib/clickup';

// Mock dependencies
jest.mock('../../workflow', () => ({
  taskOrchestrator: {
    processTask: jest.fn(),
    getTaskStatus: jest.fn(),
    getActiveTasks: jest.fn(),
    rerunCodexReview: jest.fn(),
    rerunClaudeFixes: jest.fn(),
  },
}));

jest.mock('../../../../lib/storage');

// Suppress console output
suppressConsole();

describe('OrchestratorService (Legacy Wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processTask', () => {
    it('should delegate to workflow orchestrator', async () => {
      const task = createMockClickUpTask({
        id: 'test-task-123',
        name: 'Test Feature',
      });

      const expectedResult = {
        success: true,
        pipeline: {
          taskId: 'test-task-123',
          taskName: 'Test Feature',
          currentStage: 'completed',
          status: 'completed',
        } as storage.PipelineData,
      };

      (taskOrchestrator.processTask as jest.Mock).mockResolvedValue(expectedResult);

      const result = await orchestratorService.processTask(task);

      // Verify delegation
      expect(taskOrchestrator.processTask).toHaveBeenCalledWith(task);
      expect(result).toEqual(expectedResult);
    });

    it('should return failure result when workflow fails', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const expectedResult = {
        success: false,
        error: 'Implementation failed',
        pipeline: {
          taskId: 'test-task-123',
          taskName: 'Test Feature',
          currentStage: 'implementing',
          status: 'failed',
        } as storage.PipelineData,
      };

      (taskOrchestrator.processTask as jest.Mock).mockResolvedValue(expectedResult);

      const result = await orchestratorService.processTask(task);

      expect(taskOrchestrator.processTask).toHaveBeenCalledWith(task);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Implementation failed');
    });

    it('should handle exceptions from workflow orchestrator', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const error = new Error('Orchestrator crashed');
      (taskOrchestrator.processTask as jest.Mock).mockRejectedValue(error);

      await expect(orchestratorService.processTask(task)).rejects.toThrow('Orchestrator crashed');
    });
  });

  describe('getTaskStatus', () => {
    it('should delegate to workflow orchestrator and return status', () => {
      const taskId = 'test-task-123';
      const expectedStatus: storage.PipelineSummary = {
        taskId,
        taskName: 'Test Task',
        currentStage: 'implementing',
        status: 'in_progress',
        progress: 50,
        duration: 1000,
        reviewIterations: 0,
        hasErrors: false,
      };

      (taskOrchestrator.getTaskStatus as jest.Mock).mockReturnValue(expectedStatus);

      const result = orchestratorService.getTaskStatus(taskId);

      expect(taskOrchestrator.getTaskStatus).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedStatus);
    });

    it('should return null when task not found', () => {
      const taskId = 'non-existent-task';

      (taskOrchestrator.getTaskStatus as jest.Mock).mockReturnValue(null);

      const result = orchestratorService.getTaskStatus(taskId);

      expect(result).toBeNull();
    });
  });

  describe('getActiveTasks', () => {
    it('should delegate to workflow orchestrator and return active tasks', () => {
      const expectedTasks: storage.PipelineData[] = [
        {
          taskId: 'task-1',
          taskName: 'Task 1',
          currentStage: 'implementing',
          status: 'in_progress',
          stages: [],
          metadata: {},
          errors: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          taskId: 'task-2',
          taskName: 'Task 2',
          currentStage: 'analyzing',
          status: 'in_progress',
          stages: [],
          metadata: {},
          errors: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      (taskOrchestrator.getActiveTasks as jest.Mock).mockReturnValue(expectedTasks);

      const result = orchestratorService.getActiveTasks();

      expect(taskOrchestrator.getActiveTasks).toHaveBeenCalled();
      expect(result).toEqual(expectedTasks);
    });

    it('should return empty array when no active tasks', () => {
      (taskOrchestrator.getActiveTasks as jest.Mock).mockReturnValue([]);

      const result = orchestratorService.getActiveTasks();

      expect(result).toEqual([]);
    });
  });

  describe('rerunCodexReview', () => {
    it('should delegate to workflow orchestrator', async () => {
      const taskId = 'test-task-123';
      const expectedResult = {
        success: true,
        branch: 'task-test-task-123',
      };

      (taskOrchestrator.rerunCodexReview as jest.Mock).mockResolvedValue(expectedResult);

      const result = await orchestratorService.rerunCodexReview(taskId);

      expect(taskOrchestrator.rerunCodexReview).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedResult);
    });

    it('should return failure when rerun fails', async () => {
      const taskId = 'test-task-123';
      const expectedResult = {
        success: false,
        error: 'Review failed',
      };

      (taskOrchestrator.rerunCodexReview as jest.Mock).mockResolvedValue(expectedResult);

      const result = await orchestratorService.rerunCodexReview(taskId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Review failed');
    });
  });

  describe('rerunClaudeFixes', () => {
    it('should delegate to workflow orchestrator', async () => {
      const taskId = 'test-task-123';
      const expectedResult = {
        success: true,
        branch: 'task-test-task-123',
      };

      (taskOrchestrator.rerunClaudeFixes as jest.Mock).mockResolvedValue(expectedResult);

      const result = await orchestratorService.rerunClaudeFixes(taskId);

      expect(taskOrchestrator.rerunClaudeFixes).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(expectedResult);
    });

    it('should return failure when rerun fails', async () => {
      const taskId = 'test-task-123';
      const expectedResult = {
        success: false,
        error: 'Fixes failed',
      };

      (taskOrchestrator.rerunClaudeFixes as jest.Mock).mockResolvedValue(expectedResult);

      const result = await orchestratorService.rerunClaudeFixes(taskId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fixes failed');
    });
  });
});
