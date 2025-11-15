/**
 * Context Orchestrator - Intelligent Context Loading
 *
 * Provides a unified interface for loading context using:
 * 1. RAG System (premium, semantic search with OpenAI embeddings)
 * 2. Smart Context Loader (free, hash-based embeddings)
 *
 * Strategy:
 * - Try RAG first if OpenAI API key is available
 * - Fallback to Smart Context Loader if RAG unavailable or fails
 * - Track metrics for both approaches
 *
 * @module context-orchestrator
 */

import { RagService } from '@/core/rag';
import { SmartContextLoader } from './smart-context-loader.service';
import { logger } from '@/shared/utils/logger.util';
import type { ContextLoadMetrics, LoadContextOptions } from './types';

export class ContextOrchestrator {
  private ragService: RagService | null = null;
  private smartLoader: SmartContextLoader;
  private metrics: ContextLoadMetrics[] = [];

  constructor(private openAIApiKey?: string) {
    this.smartLoader = new SmartContextLoader();

    // Initialize RAG if API key available
    if (openAIApiKey) {
      this.ragService = new RagService(openAIApiKey);
    }
  }

  /**
   * Initialize the context loading systems
   */
  async initialize(): Promise<void> {
    logger.info('Initializing context orchestrator...');

    if (this.ragService) {
      try {
        await this.ragService.initialize();
        logger.info('RAG system initialized successfully');
      } catch (error) {
        logger.warn('RAG initialization failed, will use Smart Loader only', {
          error: (error as Error).message
        });
        this.ragService = null;
      }
    }

    logger.info('Context orchestrator ready', {
      ragEnabled: !!this.ragService,
      smartLoaderEnabled: true
    });
  }

  /**
   * Load context intelligently using best available method
   */
  async loadContext(options: LoadContextOptions): Promise<string> {
    const startTime = Date.now();
    const { model, taskDescription, category, minRelevance = 0.7, topK = 5 } = options;

    try {
      // Try RAG first if available
      if (this.ragService) {
        logger.debug('Attempting RAG context loading', { model });

        try {
          const context = await this.ragService.getFormattedContext({
            query: taskDescription,
            topK,
            category,
            minRelevanceScore: minRelevance
          });

          if (context && context.trim().length > 0) {
            const loadTimeMs = Date.now() - startTime;

            this.trackMetrics({
              provider: 'rag',
              model,
              loadTimeMs,
              chunksReturned: this.countChunks(context),
              totalTokens: this.estimateTokens(context),
              cacheHit: false, // RAG doesn't expose cache info
              timestamp: new Date().toISOString()
            });

            logger.info('Context loaded via RAG', {
              model,
              chunks: this.countChunks(context),
              loadTimeMs
            });

            return context;
          }

          logger.debug('RAG returned empty context, falling back to Smart Loader');
        } catch (ragError) {
          logger.warn('RAG context loading failed, falling back to Smart Loader', {
            error: (ragError as Error).message
          });
        }
      }

      // Fallback to Smart Context Loader
      logger.debug('Using Smart Context Loader', { model });

      const context = await this.smartLoader.loadRelevant({
        model: model as 'claude' | 'gemini' | 'codex' | 'qwen',
        taskDescription,
        includeProject: true,
        includeExamples: true
      });

      const loadTimeMs = Date.now() - startTime;

      this.trackMetrics({
        provider: 'smart',
        model,
        loadTimeMs,
        chunksReturned: this.countChunks(context),
        totalTokens: this.estimateTokens(context),
        cacheHit: true, // Smart Loader uses file cache
        timestamp: new Date().toISOString()
      });

      logger.info('Context loaded via Smart Loader', {
        model,
        chunks: this.countChunks(context),
        loadTimeMs
      });

      return context;

    } catch (error) {
      logger.error('All context loading methods failed', {
        error: (error as Error).message
      });

      // Last resort: return empty context (allow AI to work without context)
      return '';
    }
  }

  /**
   * Get context loading statistics
   */
  getStats() {
    const totalLoads = this.metrics.length;
    const ragLoads = this.metrics.filter(m => m.provider === 'rag').length;
    const smartLoads = this.metrics.filter(m => m.provider === 'smart').length;

    const avgLoadTime = totalLoads > 0
      ? this.metrics.reduce((sum, m) => sum + m.loadTimeMs, 0) / totalLoads
      : 0;

    const cacheHitRate = totalLoads > 0
      ? this.metrics.filter(m => m.cacheHit).length / totalLoads
      : 0;

    const avgChunks = totalLoads > 0
      ? this.metrics.reduce((sum, m) => sum + m.chunksReturned, 0) / totalLoads
      : 0;

    return {
      totalLoads,
      ragLoads,
      smartLoads,
      ragPercentage: totalLoads > 0 ? (ragLoads / totalLoads) * 100 : 0,
      avgLoadTimeMs: Math.round(avgLoadTime),
      cacheHitRate: Math.round(cacheHitRate * 100),
      avgChunksReturned: Math.round(avgChunks)
    };
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Track metrics for monitoring
   */
  private trackMetrics(metrics: ContextLoadMetrics): void {
    this.metrics.push(metrics);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    logger.debug('Context load metrics', metrics);
  }

  /**
   * Count chunks in formatted context
   */
  private countChunks(context: string): number {
    // Count markdown headers (## or ###) as chunk boundaries
    const matches = context.match(/^#{2,3}\s/gm);
    return matches ? matches.length : 1;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}

/**
 * Singleton instance for global use
 */
let orchestratorInstance: ContextOrchestrator | null = null;

/**
 * Initialize the context orchestrator
 */
export async function initializeContextOrchestrator(openAIApiKey?: string): Promise<ContextOrchestrator> {
  if (!orchestratorInstance) {
    orchestratorInstance = new ContextOrchestrator(openAIApiKey);
    await orchestratorInstance.initialize();
  }
  return orchestratorInstance;
}

/**
 * Get the context orchestrator instance
 */
export function getContextOrchestrator(): ContextOrchestrator {
  if (!orchestratorInstance) {
    throw new Error('Context orchestrator not initialized. Call initializeContextOrchestrator first.');
  }
  return orchestratorInstance;
}

/**
 * Convenience function to load context (initializes if needed)
 */
export async function loadContextForModel(options: LoadContextOptions): Promise<string> {
  if (!orchestratorInstance) {
    await initializeContextOrchestrator(process.env.OPENAI_API_KEY);
  }
  return orchestratorInstance!.loadContext(options);
}
