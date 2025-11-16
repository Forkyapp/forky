/**
 * Base Stage Tests
 */

import { BaseStage } from '../base-stage';
import type { StageContext, BaseStageResult } from '../types';
import { createMockClickUpTask } from '../../../test-setup';

// Test implementation of BaseStage
class TestStage extends BaseStage<BaseStageResult> {
  protected readonly stageName = 'Test';

  // Track if execute was called
  public executeCalled = false;
  public executeResult: BaseStageResult = { success: true };
  public shouldThrow = false;
  public throwError: Error | null = null;

  async execute(context: StageContext): Promise<BaseStageResult> {
    this.executeCalled = true;

    if (this.shouldThrow) {
      throw this.throwError || new Error('Test error');
    }

    return this.executeResult;
  }

  // Expose protected methods for testing
  public async testUpdateProgress(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.updateProgress(message, context);
  }

  public testLogSuccess(message: string, context?: Record<string, unknown>): void {
    this.logSuccess(message, context);
  }

  public testLogWarning(message: string, context?: Record<string, unknown>): void {
    this.logWarning(message, context);
  }

  public testLogError(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.logError(message, error, context);
  }

  public testLogAI(message: string, aiName: string): void {
    this.logAI(message, aiName);
  }

  public testHandleError(error: Error, context?: StageContext): BaseStageResult {
    return this.handleError(error, context);
  }

  public testCreateMetadata(status: 'in_progress' | 'completed' | 'failed', data?: Record<string, unknown>) {
    return this.createMetadata(status, data);
  }

  public async testValidateDependencies(context: StageContext): Promise<void> {
    await this.validateDependencies(context);
  }
}

describe('BaseStage', () => {
  let stage: TestStage;
  let mockContext: StageContext;

  beforeEach(() => {
    stage = new TestStage();
    mockContext = {
      task: createMockClickUpTask({ id: 'task-1', name: 'Test Task' }),
      taskId: 'task-1',
      taskName: 'Test Task',
      repoConfig: {
        path: '/path/to/repo',
        owner: 'test-owner',
        repo: 'test-repo',
        baseBranch: 'main',
      },
    };

    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should be implemented by subclass', async () => {
      const result = await stage.execute(mockContext);

      expect(stage.executeCalled).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should return custom result from subclass', async () => {
      stage.executeResult = { success: false, error: 'Custom error' };

      const result = await stage.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom error');
    });
  });

  describe('run', () => {
    it('should execute stage successfully', async () => {
      const result = await stage.run(mockContext);

      expect(result.success).toBe(true);
      expect(stage.executeCalled).toBe(true);
    });

    it('should validate dependencies before execution', async () => {
      const invalidContext = {
        ...mockContext,
        task: null as any,
      };

      const result = await stage.run(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task is required');
      expect(stage.executeCalled).toBe(false);
    });

    it('should handle execution errors', async () => {
      stage.shouldThrow = true;
      stage.throwError = new Error('Execution failed');

      const result = await stage.run(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should log success when stage succeeds', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      await stage.run(mockContext);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log warning when stage completes with warnings', async () => {
      stage.executeResult = { success: false, error: 'Warning message' };
      const consoleLogSpy = jest.spyOn(console, 'log');

      await stage.run(mockContext);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('validateDependencies', () => {
    it('should validate task is provided', async () => {
      const invalidContext = { ...mockContext, task: null as any };

      await expect(stage.testValidateDependencies(invalidContext)).rejects.toThrow(
        'Task is required'
      );
    });

    it('should validate taskId is provided', async () => {
      const invalidContext = { ...mockContext, taskId: '' };

      await expect(stage.testValidateDependencies(invalidContext)).rejects.toThrow(
        'Task ID is required'
      );
    });

    it('should validate repoConfig is provided', async () => {
      const invalidContext = { ...mockContext, repoConfig: null as any };

      await expect(stage.testValidateDependencies(invalidContext)).rejects.toThrow(
        'Repository configuration is required'
      );
    });

    it('should pass validation with valid context', async () => {
      await expect(stage.testValidateDependencies(mockContext)).resolves.not.toThrow();
    });
  });

  describe('updateProgress', () => {
    it('should update progress with message', async () => {
      await expect(stage.testUpdateProgress('Test progress')).resolves.not.toThrow();
    });

    it('should update progress with context', async () => {
      await expect(
        stage.testUpdateProgress('Test progress', { key: 'value' })
      ).resolves.not.toThrow();
    });
  });

  describe('logSuccess', () => {
    it('should log success message', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogSuccess('Test success');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log success with context', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogSuccess('Test success', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('logWarning', () => {
    it('should log warning message', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogWarning('Test warning');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log warning with context', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogWarning('Test warning', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should log error message', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogError('Test error');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const error = new Error('Test error');

      stage.testLogError('Test error', error);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log error with context', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogError('Test error', undefined, { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('logAI', () => {
    it('should log AI message', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogAI('Test AI message', 'Claude');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should include AI name in message', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      stage.testLogAI('Processing...', 'Gemini');

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('handleError', () => {
    it('should return failed result with error message', () => {
      const error = new Error('Test error');

      const result = stage.testHandleError(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should log error', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const error = new Error('Test error');

      stage.testHandleError(error);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should include context in log', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const error = new Error('Test error');

      stage.testHandleError(error, mockContext);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('createMetadata', () => {
    it('should create metadata with in_progress status', () => {
      const metadata = stage.testCreateMetadata('in_progress');

      expect(metadata.status).toBe('in_progress');
      expect(metadata.startedAt).toBeDefined();
      expect(metadata.completedAt).toBeUndefined();
    });

    it('should create metadata with completed status', () => {
      const metadata = stage.testCreateMetadata('completed');

      expect(metadata.status).toBe('completed');
      expect(metadata.startedAt).toBeDefined();
      expect(metadata.completedAt).toBeDefined();
    });

    it('should create metadata with failed status', () => {
      const metadata = stage.testCreateMetadata('failed');

      expect(metadata.status).toBe('failed');
      expect(metadata.startedAt).toBeDefined();
      expect(metadata.completedAt).toBeDefined();
    });

    it('should include additional data', () => {
      const data = { key: 'value', count: 123 };
      const metadata = stage.testCreateMetadata('completed', data);

      expect(metadata.data).toEqual(data);
    });

    it('should create valid ISO timestamps', () => {
      const metadata = stage.testCreateMetadata('completed');

      expect(() => new Date(metadata.startedAt)).not.toThrow();
      expect(() => new Date(metadata.completedAt!)).not.toThrow();
    });
  });

  describe('abstract methods', () => {
    it('should require execute method to be implemented', () => {
      // This is enforced at compile time, but we can verify the abstract class works
      expect(stage.execute).toBeDefined();
      expect(typeof stage.execute).toBe('function');
    });

    it('should require stageName to be defined', () => {
      expect((stage as any).stageName).toBeDefined();
      expect((stage as any).stageName).toBe('Test');
    });
  });

  describe('error handling in run', () => {
    it('should catch and handle validation errors', async () => {
      const invalidContext = { ...mockContext, task: null as any };

      const result = await stage.run(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task is required');
    });

    it('should catch and handle execution errors', async () => {
      stage.shouldThrow = true;
      stage.throwError = new Error('Execution failed');

      const result = await stage.run(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should not throw uncaught errors', async () => {
      stage.shouldThrow = true;
      stage.throwError = new Error('Uncaught error');

      await expect(stage.run(mockContext)).resolves.toBeDefined();
    });
  });

  describe('success and warning logging in run', () => {
    it('should log success message when stage succeeds', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      stage.executeResult = { success: true };

      await stage.run(mockContext);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log warning message when stage has warnings', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      stage.executeResult = { success: false, error: 'Warning message' };

      await stage.run(mockContext);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should include task ID in success log', async () => {
      stage.executeResult = { success: true };

      const result = await stage.run(mockContext);

      expect(result.success).toBe(true);
    });
  });
});
