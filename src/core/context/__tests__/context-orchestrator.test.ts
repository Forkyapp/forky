/**
 * Context Orchestrator Tests
 * Tests for intelligent context loading orchestration
 */

import { ContextOrchestrator, initializeContextOrchestrator, getContextOrchestrator, loadContextForModel } from '../context-orchestrator';
import { RagService } from '@/core/rag';
import { SmartContextLoader } from '../smart-context-loader.service';
import { suppressConsole } from '../../../test-setup';
import type { LoadContextOptions } from '../types';

// Mock dependencies
jest.mock('@/core/rag');
jest.mock('../smart-context-loader.service');
jest.mock('@/shared/utils/logger.util', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Suppress console output
suppressConsole();

describe('ContextOrchestrator', () => {
  let orchestrator: ContextOrchestrator;
  let mockRagService: jest.Mocked<RagService>;
  let mockSmartLoader: jest.Mocked<SmartContextLoader>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock RagService
    mockRagService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getFormattedContext: jest.fn(),
    } as any;

    // Mock SmartContextLoader
    mockSmartLoader = {
      loadRelevant: jest.fn(),
    } as any;

    (RagService as jest.MockedClass<typeof RagService>).mockImplementation(() => mockRagService);
    (SmartContextLoader as jest.MockedClass<typeof SmartContextLoader>).mockImplementation(() => mockSmartLoader);
  });

  describe('constructor', () => {
    it('should initialize with SmartContextLoader', () => {
      orchestrator = new ContextOrchestrator();

      expect(SmartContextLoader).toHaveBeenCalled();
    });

    it('should initialize RagService when API key provided', () => {
      const apiKey = 'test-api-key';
      orchestrator = new ContextOrchestrator(apiKey);

      expect(RagService).toHaveBeenCalledWith(apiKey);
    });

    it('should not initialize RagService when no API key provided', () => {
      orchestrator = new ContextOrchestrator();

      expect(RagService).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should initialize RAG service when available', async () => {
      const apiKey = 'test-api-key';
      orchestrator = new ContextOrchestrator(apiKey);

      await orchestrator.initialize();

      expect(mockRagService.initialize).toHaveBeenCalled();
    });

    it('should handle RAG initialization failure gracefully', async () => {
      const apiKey = 'test-api-key';
      orchestrator = new ContextOrchestrator(apiKey);

      mockRagService.initialize.mockRejectedValue(new Error('RAG init failed'));

      await orchestrator.initialize();

      expect(mockRagService.initialize).toHaveBeenCalled();
    });

    it('should skip RAG initialization when no API key', async () => {
      orchestrator = new ContextOrchestrator();

      await orchestrator.initialize();

      expect(mockRagService.initialize).not.toHaveBeenCalled();
    });
  });

  describe('loadContext', () => {
    beforeEach(async () => {
      orchestrator = new ContextOrchestrator('test-api-key');
      await orchestrator.initialize();
    });

    it('should use RAG service when available and successful', async () => {
      const options: LoadContextOptions = {
        model: 'claude',
        taskDescription: 'Implement user authentication',
        category: 'patterns/backend',
        minRelevance: 0.7,
        topK: 5,
      };

      const mockContext = '## Authentication Pattern\n\nDetailed context here...';
      mockRagService.getFormattedContext.mockResolvedValue(mockContext);

      const result = await orchestrator.loadContext(options);

      expect(mockRagService.getFormattedContext).toHaveBeenCalledWith({
        query: options.taskDescription,
        topK: 5,
        category: 'patterns/backend',
        minRelevanceScore: 0.7,
      });

      expect(result).toBe(mockContext);
      expect(mockSmartLoader.loadRelevant).not.toHaveBeenCalled();
    });

    it('should fallback to SmartLoader when RAG returns empty context', async () => {
      const options: LoadContextOptions = {
        model: 'claude',
        taskDescription: 'Test task',
        topK: 5,
      };

      mockRagService.getFormattedContext.mockResolvedValue('');

      const fallbackContext = '## Fallback Context\n\nSmart loader context...';
      mockSmartLoader.loadRelevant.mockResolvedValue(fallbackContext);

      const result = await orchestrator.loadContext(options);

      expect(mockSmartLoader.loadRelevant).toHaveBeenCalledWith({
        model: 'claude',
        taskDescription: 'Test task',
        includeProject: true,
        includeExamples: true,
      });

      expect(result).toBe(fallbackContext);
    });

    it('should fallback to SmartLoader when RAG fails', async () => {
      const options: LoadContextOptions = {
        model: 'gemini',
        taskDescription: 'Test task',
        topK: 5,
      };

      mockRagService.getFormattedContext.mockRejectedValue(new Error('RAG failed'));

      const fallbackContext = '## Smart Loader Context\n\nContext data...';
      mockSmartLoader.loadRelevant.mockResolvedValue(fallbackContext);

      const result = await orchestrator.loadContext(options);

      expect(mockSmartLoader.loadRelevant).toHaveBeenCalled();
      expect(result).toBe(fallbackContext);
    });

    it('should use SmartLoader when RAG not available', async () => {
      orchestrator = new ContextOrchestrator();
      await orchestrator.initialize();

      const options: LoadContextOptions = {
        model: 'codex',
        taskDescription: 'Review code',
        topK: 3,
      };

      const smartContext = '## Code Review Context\n\nReview guidelines...';
      mockSmartLoader.loadRelevant.mockResolvedValue(smartContext);

      const result = await orchestrator.loadContext(options);

      expect(mockSmartLoader.loadRelevant).toHaveBeenCalledWith({
        model: 'codex',
        taskDescription: 'Review code',
        includeProject: true,
        includeExamples: true,
      });

      expect(result).toBe(smartContext);
      expect(mockRagService.getFormattedContext).not.toHaveBeenCalled();
    });

    it('should return empty string when all methods fail', async () => {
      orchestrator = new ContextOrchestrator();
      await orchestrator.initialize();

      const options: LoadContextOptions = {
        model: 'claude',
        taskDescription: 'Test task',
        topK: 5,
      };

      mockSmartLoader.loadRelevant.mockRejectedValue(new Error('All failed'));

      const result = await orchestrator.loadContext(options);

      expect(result).toBe('');
    });

    it('should use default values for optional parameters', async () => {
      orchestrator = new ContextOrchestrator('test-api-key');
      await orchestrator.initialize();

      const options: LoadContextOptions = {
        model: 'claude',
        taskDescription: 'Test task',
      };

      mockRagService.getFormattedContext.mockResolvedValue('Context');

      await orchestrator.loadContext(options);

      expect(mockRagService.getFormattedContext).toHaveBeenCalledWith({
        query: 'Test task',
        topK: 5,
        category: undefined,
        minRelevanceScore: 0.7,
      });
    });

    it('should track metrics for RAG context loading', async () => {
      orchestrator = new ContextOrchestrator('test-api-key');
      await orchestrator.initialize();

      const options: LoadContextOptions = {
        model: 'claude',
        taskDescription: 'Test task',
        topK: 5,
      };

      const mockContext = '## Section 1\n\n## Section 2\n\nContent';
      mockRagService.getFormattedContext.mockResolvedValue(mockContext);

      await orchestrator.loadContext(options);

      const stats = orchestrator.getStats();

      expect(stats.totalLoads).toBe(1);
      expect(stats.ragLoads).toBe(1);
      expect(stats.smartLoads).toBe(0);
    });

    it('should track metrics for SmartLoader context loading', async () => {
      orchestrator = new ContextOrchestrator();
      await orchestrator.initialize();

      const options: LoadContextOptions = {
        model: 'claude',
        taskDescription: 'Test task',
        topK: 5,
      };

      mockSmartLoader.loadRelevant.mockResolvedValue('## Context\n\nData');

      await orchestrator.loadContext(options);

      const stats = orchestrator.getStats();

      expect(stats.totalLoads).toBe(1);
      expect(stats.ragLoads).toBe(0);
      expect(stats.smartLoads).toBe(1);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      orchestrator = new ContextOrchestrator('test-api-key');
      await orchestrator.initialize();
    });

    it('should return correct statistics', async () => {
      mockRagService.getFormattedContext.mockResolvedValue('## Context\n\nData');

      await orchestrator.loadContext({
        model: 'claude',
        taskDescription: 'Task 1',
        topK: 5,
      });

      await orchestrator.loadContext({
        model: 'gemini',
        taskDescription: 'Task 2',
        topK: 5,
      });

      const stats = orchestrator.getStats();

      expect(stats.totalLoads).toBe(2);
      expect(stats.ragLoads).toBe(2);
      expect(stats.ragPercentage).toBe(100);
      expect(stats.avgLoadTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return zero stats when no loads', () => {
      const stats = orchestrator.getStats();

      expect(stats.totalLoads).toBe(0);
      expect(stats.ragLoads).toBe(0);
      expect(stats.smartLoads).toBe(0);
      expect(stats.ragPercentage).toBe(0);
      expect(stats.avgLoadTimeMs).toBe(0);
    });

    it('should calculate mixed RAG and SmartLoader percentages', async () => {
      mockRagService.getFormattedContext
        .mockResolvedValueOnce('RAG context')
        .mockRejectedValueOnce(new Error('RAG failed'));

      mockSmartLoader.loadRelevant.mockResolvedValue('Smart context');

      await orchestrator.loadContext({
        model: 'claude',
        taskDescription: 'Task 1',
        topK: 5,
      });

      await orchestrator.loadContext({
        model: 'claude',
        taskDescription: 'Task 2',
        topK: 5,
      });

      const stats = orchestrator.getStats();

      expect(stats.totalLoads).toBe(2);
      expect(stats.ragLoads).toBe(1);
      expect(stats.smartLoads).toBe(1);
      expect(stats.ragPercentage).toBe(50);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', async () => {
      orchestrator = new ContextOrchestrator('test-api-key');
      await orchestrator.initialize();

      mockRagService.getFormattedContext.mockResolvedValue('Context');

      await orchestrator.loadContext({
        model: 'claude',
        taskDescription: 'Test',
        topK: 5,
      });

      expect(orchestrator.getStats().totalLoads).toBe(1);

      orchestrator.clearMetrics();

      expect(orchestrator.getStats().totalLoads).toBe(0);
    });
  });

  describe('singleton functions', () => {
    it('should initialize singleton instance', async () => {
      const instance = await initializeContextOrchestrator('test-api-key');

      expect(instance).toBeInstanceOf(ContextOrchestrator);
    });

    it('should return same instance on subsequent calls', async () => {
      const instance1 = await initializeContextOrchestrator('test-api-key');
      const instance2 = await initializeContextOrchestrator('different-key');

      expect(instance1).toBe(instance2);
    });

    it('should get initialized orchestrator', async () => {
      await initializeContextOrchestrator('test-api-key');
      const instance = getContextOrchestrator();

      expect(instance).toBeInstanceOf(ContextOrchestrator);
    });

    it('should lazy initialize and load context', async () => {
      mockSmartLoader.loadRelevant.mockResolvedValue('Context');

      const result = await loadContextForModel({
        model: 'claude',
        taskDescription: 'Test',
        topK: 5,
      });

      expect(result).toBeDefined();
    });
  });
});
