/**
 * Analysis Stage Tests
 * Tests for Gemini-powered task analysis stage
 */

import { AnalysisStage } from '../analysis.stage';
import * as storage from '../../../../lib/storage';
import * as gemini from '../../ai-services/gemini.service';
import * as clickup from '../../../../lib/clickup';
import { createMockClickUpTask, suppressConsole } from '../../../test-setup';
import type { StageContext, AnalysisResult } from '../types';

// Mock dependencies
jest.mock('../../../../lib/storage');
jest.mock('../../ai-services/gemini.service');
jest.mock('../../../../lib/clickup');

// Suppress console output
suppressConsole();

describe('AnalysisStage', () => {
  let stage: AnalysisStage;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default storage mocks
    (storage.pipeline.updateStage as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.completeStage as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.failStage as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.updateMetadata as jest.Mock).mockImplementation(() => {});
    (storage.pipeline.storeAgentExecution as jest.Mock).mockImplementation(() => {});

    // Setup default clickup mocks
    (clickup.addComment as jest.Mock).mockResolvedValue({ success: true });

    // Setup STAGES constant
    (storage.pipeline as any).STAGES = {
      ANALYZING: 'analyzing',
      ANALYZED: 'analyzed',
    };

    stage = new AnalysisStage();
  });

  describe('execute', () => {
    it('should successfully analyze task with Gemini', async () => {
      const task = createMockClickUpTask({
        id: 'test-task-123',
        name: 'Implement user authentication',
      });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Implement user authentication',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      const mockAnalysisResult = {
        featureSpecFile: '/test/features/task-123/feature-spec.md',
        logFile: '/test/logs/gemini-task-123.log',
        progressFile: '/test/logs/gemini-task-123-progress.json',
        fallback: false,
      };

      (gemini.analyzeTask as jest.Mock).mockResolvedValue(mockAnalysisResult);

      const result = await stage.run(context);

      // Verify Gemini was called
      expect(gemini.analyzeTask).toHaveBeenCalledWith(task, {
        repoConfig: context.repoConfig,
      });

      // Verify pipeline updated
      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'test-task-123',
        'analyzing',
        expect.objectContaining({ name: 'Gemini Analysis' })
      );

      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'test-task-123',
        'analyzing',
        expect.objectContaining({
          featureSpecFile: mockAnalysisResult.featureSpecFile,
          fallback: false,
        })
      );

      // Verify metadata updated
      expect(storage.pipeline.updateMetadata).toHaveBeenCalledWith(
        'test-task-123',
        expect.objectContaining({
          geminiAnalysis: expect.objectContaining({
            file: mockAnalysisResult.featureSpecFile,
            fallback: false,
          }),
        })
      );

      // Verify agent execution stored
      expect(storage.pipeline.storeAgentExecution).toHaveBeenCalledWith(
        'test-task-123',
        'gemini',
        expect.objectContaining({
          logFile: mockAnalysisResult.logFile,
          progressFile: mockAnalysisResult.progressFile,
          featureSpecFile: mockAnalysisResult.featureSpecFile,
        })
      );

      // Verify start notification sent
      expect(clickup.addComment).toHaveBeenCalledWith(
        'test-task-123',
        expect.stringContaining('Gemini Analysis Started')
      );

      // Verify completion notification sent
      expect(clickup.addComment).toHaveBeenCalledWith(
        'test-task-123',
        expect.stringContaining('Gemini Analysis Complete')
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.featureSpecFile).toBe(mockAnalysisResult.featureSpecFile);
    });

    it('should handle fallback analysis when Gemini unavailable', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Test Task',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      const mockFallbackResult = {
        featureSpecFile: '/test/features/task-123/feature-spec.md',
        logFile: '/test/logs/gemini-task-123.log',
        progressFile: '/test/logs/gemini-task-123-progress.json',
        fallback: true,
      };

      (gemini.analyzeTask as jest.Mock).mockResolvedValue(mockFallbackResult);

      const result = await stage.run(context);

      // Verify fallback was used
      expect(storage.pipeline.completeStage).toHaveBeenCalledWith(
        'test-task-123',
        'analyzing',
        expect.objectContaining({
          fallback: true,
        })
      );

      // Verify completion notification mentions fallback
      expect(clickup.addComment).toHaveBeenCalledWith(
        'test-task-123',
        expect.stringContaining('Fallback mode')
      );

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
    });

    it('should handle Gemini analysis failure gracefully', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Test Task',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      const error = new Error('Gemini API error');
      (gemini.analyzeTask as jest.Mock).mockRejectedValue(error);

      const result = await stage.run(context);

      // Verify pipeline marked as failed
      expect(storage.pipeline.failStage).toHaveBeenCalledWith(
        'test-task-123',
        'analyzing',
        error
      );

      // Verify result indicates failure but allows workflow to continue
      expect(result.success).toBe(false);
      expect(result.error).toBe('Gemini API error');
      expect(result.fallback).toBe(true);
      expect(result.featureSpecFile).toBe('');
    });

    it('should handle notification failure gracefully', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Test Task',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      const mockAnalysisResult = {
        featureSpecFile: '/test/features/task-123/feature-spec.md',
        logFile: '/test/logs/gemini-task-123.log',
        progressFile: '/test/logs/gemini-task-123-progress.json',
        fallback: false,
      };

      (gemini.analyzeTask as jest.Mock).mockResolvedValue(mockAnalysisResult);
      (clickup.addComment as jest.Mock).mockRejectedValue(new Error('Comment API error'));

      // Should not throw even if notifications fail
      const result = await stage.run(context);

      // Verify analysis still succeeded
      expect(result.success).toBe(true);
      expect(result.featureSpecFile).toBe(mockAnalysisResult.featureSpecFile);
    });

    it('should update pipeline stage at start of execution', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Test Task',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      (gemini.analyzeTask as jest.Mock).mockResolvedValue({
        featureSpecFile: '/test/spec.md',
        logFile: '/test/log.log',
        progressFile: '/test/progress.json',
        fallback: false,
      });

      await stage.run(context);

      // Verify updateStage called before analysis
      expect(storage.pipeline.updateStage).toHaveBeenCalledWith(
        'test-task-123',
        'analyzing',
        expect.objectContaining({ name: 'Gemini Analysis' })
      );

      // Verify it was called before completeStage
      const updateCall = (storage.pipeline.updateStage as jest.Mock).mock.invocationCallOrder[0];
      const completeCall = (storage.pipeline.completeStage as jest.Mock).mock
        .invocationCallOrder[0];
      expect(updateCall).toBeLessThan(completeCall);
    });

    it('should include all analysis metadata in pipeline', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Test Task',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      const mockAnalysisResult = {
        featureSpecFile: '/test/features/task-123/feature-spec.md',
        logFile: '/test/logs/gemini-task-123.log',
        progressFile: '/test/logs/gemini-task-123-progress.json',
        fallback: false,
      };

      (gemini.analyzeTask as jest.Mock).mockResolvedValue(mockAnalysisResult);

      await stage.run(context);

      // Verify all metadata stored
      expect(storage.pipeline.updateMetadata).toHaveBeenCalledWith(
        'test-task-123',
        expect.objectContaining({
          geminiAnalysis: {
            file: mockAnalysisResult.featureSpecFile,
            fallback: false,
            logFile: mockAnalysisResult.logFile,
          },
        })
      );

      expect(storage.pipeline.storeAgentExecution).toHaveBeenCalledWith(
        'test-task-123',
        'gemini',
        {
          logFile: mockAnalysisResult.logFile,
          progressFile: mockAnalysisResult.progressFile,
          featureSpecFile: mockAnalysisResult.featureSpecFile,
        }
      );
    });

    it('should send start notification before analysis', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Test Task',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      (gemini.analyzeTask as jest.Mock).mockResolvedValue({
        featureSpecFile: '/test/spec.md',
        logFile: '/test/log.log',
        progressFile: '/test/progress.json',
        fallback: false,
      });

      await stage.run(context);

      // Verify start notification sent
      const startNotification = (clickup.addComment as jest.Mock).mock.calls.find(call =>
        call[1].includes('Gemini Analysis Started')
      );

      expect(startNotification).toBeDefined();
      expect(startNotification[0]).toBe('test-task-123');
      expect(startNotification[1]).toContain('analyzing the task');
    });

    it('should send completion notification with spec file name', async () => {
      const task = createMockClickUpTask({ id: 'test-task-123' });

      const context: StageContext = {
        task,
        taskId: 'test-task-123',
        taskName: 'Test Task',
        repoConfig: {
          owner: 'test-owner',
          repo: 'test-repo',
          path: '/test/repo',
          baseBranch: 'main',
        },
      };

      (gemini.analyzeTask as jest.Mock).mockResolvedValue({
        featureSpecFile: '/test/features/task-123/feature-spec.md',
        logFile: '/test/log.log',
        progressFile: '/test/progress.json',
        fallback: false,
      });

      await stage.run(context);

      // Verify completion notification includes spec file
      const completionNotification = (clickup.addComment as jest.Mock).mock.calls.find(call =>
        call[1].includes('Gemini Analysis Complete')
      );

      expect(completionNotification).toBeDefined();
      expect(completionNotification[1]).toContain('feature-spec.md');
      expect(completionNotification[1]).toContain('Claude will implement');
    });
  });
});
