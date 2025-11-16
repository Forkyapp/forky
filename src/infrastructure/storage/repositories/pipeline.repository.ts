import type { Database } from 'better-sqlite3';
import { getSQLiteClient } from '../sqlite.client';

export interface PipelineData {
  taskId: string;
  taskName: string;
  currentStage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  totalDuration?: number;
  repository?: string;
}

export interface StageEntry {
  id?: number;
  pipelineTaskId: string;
  name: string;
  stage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

export interface PipelineMetadata {
  pipelineTaskId: string;
  geminiAnalysisFile?: string;
  geminiAnalysisFallback?: boolean;
  prNumber?: number;
  reviewIterations?: number;
  maxReviewIterations?: number;
  branches?: string[];
  agentExecution?: any;
}

export interface PipelineError {
  id?: number;
  pipelineTaskId: string;
  stage: string;
  error: string;
  timestamp: string;
}

/**
 * SQLite-based Pipeline Repository
 * Replaces lib/storage/pipeline.ts
 */
export class PipelineRepository {
  private db: Database;

  constructor() {
    this.db = getSQLiteClient().getDB();
  }

  /**
   * Initialize a new pipeline
   */
  init(taskId: string, taskName: string, repository?: string): PipelineData {
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      // Insert pipeline
      this.db.prepare(`
        INSERT INTO pipelines (task_id, task_name, current_stage, status, created_at, updated_at, repository)
        VALUES (?, ?, 'detected', 'pending', ?, ?, ?)
      `).run(taskId, taskName, now, now, repository || null);

      // Insert metadata
      this.db.prepare(`
        INSERT INTO pipeline_metadata (pipeline_task_id, review_iterations, max_review_iterations)
        VALUES (?, 0, 3)
      `).run(taskId);

      return this.get(taskId)!;
    })();
  }

  /**
   * Get pipeline by task ID
   */
  get(taskId: string): PipelineData | null {
    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        current_stage as currentStage,
        status,
        created_at as createdAt,
        updated_at as updatedAt,
        completed_at as completedAt,
        failed_at as failedAt,
        total_duration as totalDuration,
        repository
      FROM pipelines
      WHERE task_id = ?
    `).get(taskId) as PipelineData | null;
  }

  /**
   * Update pipeline stage
   */
  updateStage(taskId: string, stage: string, status: string = 'in_progress'): void {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      // Update pipeline
      this.db.prepare(`
        UPDATE pipelines
        SET current_stage = ?, status = ?, updated_at = ?
        WHERE task_id = ?
      `).run(stage, status, now, taskId);

      // Insert stage entry
      this.db.prepare(`
        INSERT INTO stages (pipeline_task_id, name, stage, status, started_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(taskId, stage, stage, status, now);
    })();
  }

  /**
   * Complete a stage
   */
  completeStage(taskId: string, stage: string, duration?: number): void {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      // Update stage entry
      this.db.prepare(`
        UPDATE stages
        SET status = 'completed', completed_at = ?, duration = ?
        WHERE pipeline_task_id = ? AND stage = ? AND status = 'in_progress'
      `).run(now, duration || null, taskId, stage);

      // Update pipeline
      this.db.prepare(`
        UPDATE pipelines
        SET status = 'in_progress', updated_at = ?
        WHERE task_id = ?
      `).run(now, taskId);
    })();
  }

  /**
   * Fail a stage
   */
  failStage(taskId: string, stage: string, error: string): void {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      // Update stage entry
      this.db.prepare(`
        UPDATE stages
        SET status = 'failed', completed_at = ?, error = ?
        WHERE pipeline_task_id = ? AND stage = ? AND status = 'in_progress'
      `).run(now, error, taskId, stage);

      // Update pipeline
      this.db.prepare(`
        UPDATE pipelines
        SET status = 'failed', failed_at = ?, updated_at = ?
        WHERE task_id = ?
      `).run(now, now, taskId);

      // Add error
      this.db.prepare(`
        INSERT INTO pipeline_errors (pipeline_task_id, stage, error, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(taskId, stage, error, now);
    })();
  }

  /**
   * Complete pipeline
   */
  complete(taskId: string, totalDuration?: number): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE pipelines
      SET status = 'completed', completed_at = ?, updated_at = ?, total_duration = ?
      WHERE task_id = ?
    `).run(now, now, totalDuration || null, taskId);
  }

  /**
   * Fail pipeline
   */
  fail(taskId: string, error: string): void {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.prepare(`
        UPDATE pipelines
        SET status = 'failed', failed_at = ?, updated_at = ?
        WHERE task_id = ?
      `).run(now, now, taskId);

      this.db.prepare(`
        INSERT INTO pipeline_errors (pipeline_task_id, stage, error, timestamp)
        VALUES (?, 'unknown', ?, ?)
      `).run(taskId, error, now);
    })();
  }

  /**
   * Update metadata
   */
  updateMetadata(taskId: string, metadata: Partial<PipelineMetadata>): void {
    const updates: string[] = [];
    const values: any[] = [];

    if (metadata.geminiAnalysisFile !== undefined) {
      updates.push('gemini_analysis_file = ?');
      values.push(metadata.geminiAnalysisFile);
    }

    if (metadata.geminiAnalysisFallback !== undefined) {
      updates.push('gemini_analysis_fallback = ?');
      values.push(metadata.geminiAnalysisFallback ? 1 : 0);
    }

    if (metadata.prNumber !== undefined) {
      updates.push('pr_number = ?');
      values.push(metadata.prNumber);
    }

    if (metadata.reviewIterations !== undefined) {
      updates.push('review_iterations = ?');
      values.push(metadata.reviewIterations);
    }

    if (metadata.maxReviewIterations !== undefined) {
      updates.push('max_review_iterations = ?');
      values.push(metadata.maxReviewIterations);
    }

    if (metadata.branches !== undefined) {
      updates.push('branches = ?');
      values.push(JSON.stringify(metadata.branches));
    }

    if (metadata.agentExecution !== undefined) {
      updates.push('agent_execution = ?');
      values.push(JSON.stringify(metadata.agentExecution));
    }

    if (updates.length === 0) return;

    values.push(taskId);

    this.db.prepare(`
      UPDATE pipeline_metadata
      SET ${updates.join(', ')}
      WHERE pipeline_task_id = ?
    `).run(...values);
  }

  /**
   * Get metadata
   */
  getMetadata(taskId: string): PipelineMetadata | null {
    const row = this.db.prepare(`
      SELECT
        pipeline_task_id as pipelineTaskId,
        gemini_analysis_file as geminiAnalysisFile,
        gemini_analysis_fallback as geminiAnalysisFallback,
        pr_number as prNumber,
        review_iterations as reviewIterations,
        max_review_iterations as maxReviewIterations,
        branches,
        agent_execution as agentExecution
      FROM pipeline_metadata
      WHERE pipeline_task_id = ?
    `).get(taskId) as any;

    if (!row) return null;

    return {
      ...row,
      geminiAnalysisFallback: row.geminiAnalysisFallback === 1,
      branches: row.branches ? JSON.parse(row.branches) : undefined,
      agentExecution: row.agentExecution ? JSON.parse(row.agentExecution) : undefined
    };
  }

  /**
   * Get stages for a pipeline
   */
  getStages(taskId: string): StageEntry[] {
    return this.db.prepare(`
      SELECT
        id,
        pipeline_task_id as pipelineTaskId,
        name,
        stage,
        status,
        started_at as startedAt,
        completed_at as completedAt,
        duration,
        error
      FROM stages
      WHERE pipeline_task_id = ?
      ORDER BY started_at ASC
    `).all(taskId) as StageEntry[];
  }

  /**
   * Get errors for a pipeline
   */
  getErrors(taskId: string): PipelineError[] {
    return this.db.prepare(`
      SELECT
        id,
        pipeline_task_id as pipelineTaskId,
        stage,
        error,
        timestamp
      FROM pipeline_errors
      WHERE pipeline_task_id = ?
      ORDER BY timestamp DESC
    `).all(taskId) as PipelineError[];
  }

  /**
   * Get active pipelines (in progress)
   */
  getActive(): PipelineData[] {
    return this.db.prepare(`
      SELECT
        task_id as taskId,
        task_name as taskName,
        current_stage as currentStage,
        status,
        created_at as createdAt,
        updated_at as updatedAt,
        completed_at as completedAt,
        failed_at as failedAt,
        total_duration as totalDuration,
        repository
      FROM pipelines
      WHERE status = 'in_progress'
      ORDER BY created_at ASC
    `).all() as PipelineData[];
  }

  /**
   * Cleanup old completed/failed pipelines
   */
  cleanup(olderThanMs: number): number {
    const cutoffDate = new Date(Date.now() - olderThanMs).toISOString();

    const result = this.db.prepare(`
      DELETE FROM pipelines
      WHERE (status = 'completed' OR status = 'failed')
        AND (completed_at < ? OR failed_at < ?)
    `).run(cutoffDate, cutoffDate);

    return result.changes;
  }

  /**
   * Get full pipeline data (with stages, metadata, errors)
   */
  getFull(taskId: string): {
    pipeline: PipelineData;
    stages: StageEntry[];
    metadata: PipelineMetadata | null;
    errors: PipelineError[];
  } | null {
    const pipeline = this.get(taskId);
    if (!pipeline) return null;

    return {
      pipeline,
      stages: this.getStages(taskId),
      metadata: this.getMetadata(taskId),
      errors: this.getErrors(taskId)
    };
  }
}
