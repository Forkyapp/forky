/**
 * Pipeline Repository
 * Manages pipeline state and progress tracking
 */

import fs from 'fs';
import {
  PipelineData,
  PipelineStatus,
  PipelineStage,
  StageEntry,
  PipelineSummary,
  ClickUpTaskData,
} from '../../types';
import { FileReadError, FileWriteError, PipelineNotFoundError } from '../../shared/errors';
import { PIPELINE_STAGES, PIPELINE_STATUS } from '../../shared/constants';

export interface IPipelineRepository {
  load(): Promise<Record<string, PipelineData>>;
  save(pipelines: Record<string, PipelineData>): Promise<void>;
  get(taskId: string): Promise<PipelineData | null>;
  init(taskId: string, taskData: Partial<ClickUpTaskData>): Promise<PipelineData>;
  updateStage(taskId: string, stage: PipelineStage, stageData?: Partial<StageEntry>): Promise<PipelineData>;
  completeStage(taskId: string, stage: PipelineStage, result?: any): Promise<PipelineData>;
  failStage(taskId: string, stage: PipelineStage, error: Error | string): Promise<PipelineData>;
  updateMetadata(taskId: string, metadata: Record<string, any>): Promise<PipelineData>;
  complete(taskId: string, result?: any): Promise<PipelineData>;
  fail(taskId: string, error: Error | string): Promise<PipelineData>;
  getActive(): Promise<PipelineData[]>;
  getSummary(taskId: string): Promise<PipelineSummary | null>;
}

export class PipelineRepository implements IPipelineRepository {
  constructor(private readonly filePath: string) {}

  /**
   * Load all pipelines from file
   */
  async load(): Promise<Record<string, PipelineData>> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return {};
      }

      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  /**
   * Save all pipelines to file
   */
  async save(pipelines: Record<string, PipelineData>): Promise<void> {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(pipelines, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Get pipeline for specific task
   */
  async get(taskId: string): Promise<PipelineData | null> {
    const pipelines = await this.load();
    return pipelines[taskId] || null;
  }

  /**
   * Initialize new pipeline
   */
  async init(taskId: string, taskData: Partial<ClickUpTaskData> = {}): Promise<PipelineData> {
    const pipelines = await this.load();

    const pipeline: PipelineData = {
      taskId,
      taskName: taskData.name || taskData.title || '',
      currentStage: PIPELINE_STAGES.DETECTED,
      status: PIPELINE_STATUS.IN_PROGRESS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stages: [
        {
          name: 'detection',
          stage: PIPELINE_STAGES.DETECTED,
          status: PIPELINE_STATUS.COMPLETED,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      ],
      metadata: {
        geminiAnalysis: null,
        aiInstances: [],
        branches: [],
        prNumber: null,
        reviewIterations: 0,
        maxReviewIterations: 3,
        agentExecution: {
          gemini: null,
          claude: null,
          codex: null,
        },
      },
      errors: [],
    };

    pipelines[taskId] = pipeline;
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Update stage in pipeline
   */
  async updateStage(
    taskId: string,
    stage: PipelineStage,
    stageData: Partial<StageEntry> = {}
  ): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    let stageEntry = pipeline.stages.find((s) => s.stage === stage);

    if (!stageEntry) {
      stageEntry = {
        name: stageData.name || stage,
        stage,
        status: PIPELINE_STATUS.IN_PROGRESS,
        startedAt: new Date().toISOString(),
      };
      pipeline.stages.push(stageEntry);
    } else {
      Object.assign(stageEntry, {
        ...stageData,
        status: PIPELINE_STATUS.IN_PROGRESS,
        startedAt: new Date().toISOString(),
      });
    }

    pipeline.currentStage = stage;
    pipeline.updatedAt = new Date().toISOString();

    await this.save(pipelines);
    return pipeline;
  }

  /**
   * Mark stage as completed
   */
  async completeStage(
    taskId: string,
    stage: PipelineStage,
    result: any = {}
  ): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    const stageEntry = pipeline.stages.find((s) => s.stage === stage);

    if (stageEntry) {
      const completedAt = new Date().toISOString();
      Object.assign(stageEntry, {
        ...result,
        status: PIPELINE_STATUS.COMPLETED,
        completedAt,
        duration: Date.parse(completedAt) - Date.parse(stageEntry.startedAt),
      });
    }

    pipeline.updatedAt = new Date().toISOString();
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Mark stage as failed
   */
  async failStage(
    taskId: string,
    stage: PipelineStage,
    error: Error | string
  ): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    const stageEntry = pipeline.stages.find((s) => s.stage === stage);

    if (stageEntry) {
      stageEntry.status = PIPELINE_STATUS.FAILED;
      stageEntry.completedAt = new Date().toISOString();
      stageEntry.error = error instanceof Error ? error.message : String(error);
    }

    pipeline.errors.push({
      stage,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    pipeline.updatedAt = new Date().toISOString();
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Update pipeline metadata
   */
  async updateMetadata(taskId: string, metadata: Record<string, any>): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    pipeline.metadata = {
      ...pipeline.metadata,
      ...metadata,
    };

    pipeline.updatedAt = new Date().toISOString();
    await this.save(pipelines);

    return pipeline;
  }

  /**
   * Mark pipeline as completed
   */
  async complete(taskId: string, result: any = {}): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    const completedAt = new Date().toISOString();

    pipeline.status = PIPELINE_STATUS.COMPLETED;
    pipeline.currentStage = PIPELINE_STAGES.COMPLETED;
    pipeline.completedAt = completedAt;
    pipeline.totalDuration = Date.parse(completedAt) - Date.parse(pipeline.createdAt);

    Object.assign(pipeline.metadata, result);

    await this.save(pipelines);
    return pipeline;
  }

  /**
   * Mark pipeline as failed
   */
  async fail(taskId: string, error: Error | string): Promise<PipelineData> {
    const pipelines = await this.load();
    const pipeline = pipelines[taskId];

    if (!pipeline) {
      throw new PipelineNotFoundError(taskId);
    }

    pipeline.status = PIPELINE_STATUS.FAILED;
    pipeline.currentStage = PIPELINE_STAGES.FAILED;
    pipeline.failedAt = new Date().toISOString();
    pipeline.errors.push({
      stage: pipeline.currentStage,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    await this.save(pipelines);
    return pipeline;
  }

  /**
   * Get all active pipelines
   */
  async getActive(): Promise<PipelineData[]> {
    const pipelines = await this.load();
    return Object.values(pipelines).filter((p) => p.status === PIPELINE_STATUS.IN_PROGRESS);
  }

  /**
   * Get pipeline summary
   */
  async getSummary(taskId: string): Promise<PipelineSummary | null> {
    const pipeline = await this.get(taskId);

    if (!pipeline) {
      return null;
    }

    const completedStages = pipeline.stages.filter((s) => s.status === PIPELINE_STATUS.COMPLETED).length;
    const totalStages = 10;
    const progress = Math.round((completedStages / totalStages) * 100);

    const endTime = pipeline.completedAt || pipeline.failedAt || new Date().toISOString();
    const duration = Date.parse(endTime) - Date.parse(pipeline.createdAt);

    return {
      taskId: pipeline.taskId,
      taskName: pipeline.taskName,
      currentStage: pipeline.currentStage,
      status: pipeline.status,
      progress,
      duration,
      reviewIterations: pipeline.metadata.reviewIterations || 0,
      hasErrors: pipeline.errors.length > 0,
    };
  }
}
