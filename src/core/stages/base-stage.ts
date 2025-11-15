/**
 * Base Stage - Abstract base class for all pipeline stages
 *
 * All pipeline stages should extend this class to inherit common functionality:
 * - Progress tracking
 * - Error handling
 * - Notification management
 * - Logging
 *
 * @example
 * ```typescript
 * export class AnalysisStage extends BaseStage<AnalysisResult> {
 *   async execute(context: StageContext): Promise<AnalysisResult> {
 *     await this.updateProgress('Analyzing task...');
 *     // ... implementation
 *     return { success: true, featureSpecFile: '/path/to/spec.md' };
 *   }
 * }
 * ```
 */

import { timmy, colors } from '@/shared/ui';
import { logger } from '@/shared/utils/logger.util';
import type { StageContext, BaseStageResult, StageMetadata } from './types';

/**
 * Abstract base class for all pipeline stages
 *
 * @template TResult The result type this stage produces (must extend BaseStageResult)
 */
export abstract class BaseStage<TResult extends BaseStageResult = BaseStageResult> {
  /**
   * The name of this stage (for logging and display)
   */
  protected abstract readonly stageName: string;

  /**
   * Execute the stage
   *
   * @param context The stage execution context
   * @returns The stage result
   */
  abstract execute(context: StageContext): Promise<TResult>;

  /**
   * Update progress with a status message
   *
   * @param message The progress message
   * @param context Optional context data
   */
  protected async updateProgress(message: string, context?: Record<string, unknown>): Promise<void> {
    console.log(timmy.info(`[${this.stageName}] ${message}`));
    if (context) {
      logger.info(message, { stage: this.stageName, ...context });
    }
  }

  /**
   * Log success message
   *
   * @param message The success message
   * @param context Optional context data
   */
  protected logSuccess(message: string, context?: Record<string, unknown>): void {
    console.log(timmy.success(`[${this.stageName}] ${message}`));
    logger.info(message, { stage: this.stageName, status: 'success', ...context });
  }

  /**
   * Log warning message
   *
   * @param message The warning message
   * @param context Optional context data
   */
  protected logWarning(message: string, context?: Record<string, unknown>): void {
    console.log(timmy.warning(`[${this.stageName}] ${message}`));
    logger.warn(message, { stage: this.stageName, ...context });
  }

  /**
   * Log error message
   *
   * @param message The error message
   * @param error Optional error object
   * @param context Optional context data
   */
  protected logError(message: string, error?: Error, context?: Record<string, unknown>): void {
    console.log(timmy.error(`[${this.stageName}] ${message}`));
    logger.error(message, error || new Error(message), { stage: this.stageName, ...context });
  }

  /**
   * Log AI-related message
   *
   * @param message The AI message
   * @param aiName The name of the AI service
   */
  protected logAI(message: string, aiName: string): void {
    console.log(timmy.ai(`[${this.stageName}] ${colors.bright}${aiName}${colors.reset} ${message}`));
    logger.info(message, { stage: this.stageName, aiService: aiName });
  }

  /**
   * Handle stage errors with consistent error handling
   *
   * @param error The error that occurred
   * @param context The stage context
   * @returns A failed result with error message
   */
  protected handleError(error: Error, context?: StageContext): TResult {
    this.logError(`Stage failed: ${error.message}`, error, {
      taskId: context?.taskId,
      taskName: context?.taskName,
    });

    return {
      success: false,
      error: error.message,
    } as TResult;
  }

  /**
   * Create stage metadata
   *
   * @param status The stage status
   * @param data Optional additional data
   * @returns Stage metadata
   */
  protected createMetadata(
    status: StageMetadata['status'],
    data?: Record<string, unknown>
  ): StageMetadata {
    const metadata: StageMetadata = {
      startedAt: new Date().toISOString(),
      status,
      data,
    };

    if (status === 'completed' || status === 'failed') {
      metadata.completedAt = new Date().toISOString();
    }

    return metadata;
  }

  /**
   * Validate required dependencies before execution
   * Override this method to add stage-specific validation
   *
   * @param context The stage context
   * @throws Error if validation fails
   */
  protected async validateDependencies(context: StageContext): Promise<void> {
    if (!context.task) {
      throw new Error('Task is required');
    }
    if (!context.taskId) {
      throw new Error('Task ID is required');
    }
    if (!context.repoConfig) {
      throw new Error('Repository configuration is required');
    }
  }

  /**
   * Execute the stage with error handling and validation
   *
   * This is the main entry point that wraps execute() with common functionality
   *
   * @param context The stage execution context
   * @returns The stage result
   */
  async run(context: StageContext): Promise<TResult> {
    try {
      // Validate dependencies
      await this.validateDependencies(context);

      // Execute the stage
      const result = await this.execute(context);

      // Log success if stage succeeded
      if (result.success) {
        this.logSuccess('Stage completed successfully', {
          taskId: context.taskId,
        });
      } else {
        this.logWarning('Stage completed with warnings', {
          taskId: context.taskId,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      return this.handleError(error as Error, context);
    }
  }
}
