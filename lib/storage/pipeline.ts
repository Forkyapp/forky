import fs from 'fs';
import config from '../../src/shared/config';
import type { TaskData, PipelineData, StageEntry, PipelineSummary } from '../../src/types/storage';

const FILES = {
  pipeline: config.files.pipelineFile
};

const STAGES = {
  DETECTED: 'detected',
  INVESTIGATING: 'investigating',
  INVESTIGATED: 'investigated',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  IMPLEMENTING: 'implementing',
  IMPLEMENTED: 'implemented',
  CODEX_REVIEWING: 'codex_reviewing',
  CODEX_REVIEWED: 'codex_reviewed',
  QWEN_TESTING: 'qwen_testing',
  QWEN_TESTED: 'qwen_tested',
  CLAUDE_FIXING: 'claude_fixing',
  CLAUDE_FIXED: 'claude_fixed',
  MERGING: 'merging',
  MERGED: 'merged',
  PR_CREATING: 'pr_creating',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

const STATUS = {
  PENDING: 'pending' as const,
  IN_PROGRESS: 'in_progress' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  SKIPPED: 'skipped' as const
};

export const pipeline = {
  STAGES,
  STATUS,

  load(): Record<string, PipelineData> {
    try {
      if (fs.existsSync(FILES.pipeline)) {
        return JSON.parse(fs.readFileSync(FILES.pipeline, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading pipelines:', (error as Error).message);
    }
    return {};
  },

  save(pipelines: Record<string, PipelineData>): void {
    try {
      fs.writeFileSync(FILES.pipeline, JSON.stringify(pipelines, null, 2));
    } catch (error) {
      console.error('Error saving pipelines:', (error as Error).message);
    }
  },

  init(taskId: string, taskData: Partial<TaskData> = {}): PipelineData {
    const pipelines = this.load();

    const pipelineDataEntry: PipelineData = {
      taskId,
      taskName: taskData.name || '',
      currentStage: STAGES.DETECTED,
      status: STATUS.IN_PROGRESS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stages: [
        {
          name: 'detection',
          stage: STAGES.DETECTED,
          status: STATUS.COMPLETED,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
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
          codex: null
        }
      },
      errors: []
    };

    pipelines[taskId] = pipelineDataEntry;
    this.save(pipelines);

    return pipelineDataEntry;
  },

  get(taskId: string): PipelineData | null {
    const pipelines = this.load();
    return pipelines[taskId] || null;
  },

  updateStage(taskId: string, stage: string, stageData: Partial<StageEntry> = {}): PipelineData {
    const pipelines = this.load();
    const pipelineDataEntry = pipelines[taskId];

    if (!pipelineDataEntry) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    let stageEntry = pipelineDataEntry.stages.find(s => s.stage === stage);

    if (!stageEntry) {
      stageEntry = {
        name: stageData.name || stage,
        stage,
        status: STATUS.IN_PROGRESS,
        startedAt: new Date().toISOString()
      };
      pipelineDataEntry.stages.push(stageEntry);
    } else {
      stageEntry.status = STATUS.IN_PROGRESS;
      stageEntry.startedAt = new Date().toISOString();
    }

    Object.assign(stageEntry, stageData);

    pipelineDataEntry.currentStage = stage;
    pipelineDataEntry.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineDataEntry;
  },

  completeStage(taskId: string, stage: string, result: Record<string, unknown> = {}): PipelineData {
    const pipelines = this.load();
    const pipelineDataEntry = pipelines[taskId];

    if (!pipelineDataEntry) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    const stageEntry = pipelineDataEntry.stages.find(s => s.stage === stage);

    if (stageEntry) {
      stageEntry.status = STATUS.COMPLETED;
      stageEntry.completedAt = new Date().toISOString();
      stageEntry.duration = Date.parse(stageEntry.completedAt) - Date.parse(stageEntry.startedAt);
      Object.assign(stageEntry, result);
    }

    pipelineDataEntry.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineDataEntry;
  },

  failStage(taskId: string, stage: string, error: Error | string): PipelineData {
    const pipelines = this.load();
    const pipelineDataEntry = pipelines[taskId];

    if (!pipelineDataEntry) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    const stageEntry = pipelineDataEntry.stages.find(s => s.stage === stage);

    if (stageEntry) {
      stageEntry.status = STATUS.FAILED;
      stageEntry.completedAt = new Date().toISOString();
      stageEntry.error = error instanceof Error ? error.message : String(error);
    }

    pipelineDataEntry.errors.push({
      stage,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });

    pipelineDataEntry.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineDataEntry;
  },

  updateMetadata(taskId: string, metadata: Record<string, unknown>): PipelineData {
    const pipelines = this.load();
    const pipelineDataEntry = pipelines[taskId];

    if (!pipelineDataEntry) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    pipelineDataEntry.metadata = {
      ...pipelineDataEntry.metadata,
      ...metadata
    };

    pipelineDataEntry.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineDataEntry;
  },

  complete(taskId: string, result: Record<string, unknown> = {}): PipelineData {
    const pipelines = this.load();
    const pipelineDataEntry = pipelines[taskId];

    if (!pipelineDataEntry) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    pipelineDataEntry.status = STATUS.COMPLETED;
    pipelineDataEntry.currentStage = STAGES.COMPLETED;
    pipelineDataEntry.completedAt = new Date().toISOString();
    pipelineDataEntry.totalDuration = Date.parse(pipelineDataEntry.completedAt) - Date.parse(pipelineDataEntry.createdAt);

    Object.assign(pipelineDataEntry.metadata, result);

    this.save(pipelines);
    return pipelineDataEntry;
  },

  fail(taskId: string, error: Error | string): PipelineData {
    const pipelines = this.load();
    const pipelineDataEntry = pipelines[taskId];

    if (!pipelineDataEntry) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    pipelineDataEntry.status = STATUS.FAILED;
    pipelineDataEntry.currentStage = STAGES.FAILED;
    pipelineDataEntry.failedAt = new Date().toISOString();
    pipelineDataEntry.errors.push({
      stage: pipelineDataEntry.currentStage,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });

    this.save(pipelines);
    return pipelineDataEntry;
  },

  getActive(): PipelineData[] {
    const pipelines = this.load();
    return Object.values(pipelines).filter(
      p => p.status === STATUS.IN_PROGRESS
    );
  },

  cleanup(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const pipelines = this.load();
    const cutoffTime = Date.now() - olderThanMs;
    let cleaned = 0;

    for (const [taskId, pipelineDataEntry] of Object.entries(pipelines)) {
      const completedAt = pipelineDataEntry.completedAt || pipelineDataEntry.failedAt;
      if (completedAt && Date.parse(completedAt) < cutoffTime) {
        delete pipelines[taskId];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.save(pipelines);
    }

    return cleaned;
  },

  getSummary(taskId: string): PipelineSummary | null {
    const pipelineDataEntry = this.get(taskId);

    if (!pipelineDataEntry) {
      return null;
    }

    return {
      taskId: pipelineDataEntry.taskId,
      taskName: pipelineDataEntry.taskName,
      currentStage: pipelineDataEntry.currentStage,
      status: pipelineDataEntry.status,
      progress: this._calculateProgress(pipelineDataEntry),
      duration: this._calculateDuration(pipelineDataEntry),
      reviewIterations: pipelineDataEntry.metadata.reviewIterations || 0,
      hasErrors: pipelineDataEntry.errors.length > 0
    };
  },

  _calculateProgress(pipelineDataEntry: PipelineData): number {
    const totalStages = 10;
    const completedStages = pipelineDataEntry.stages.filter(
      s => s.status === STATUS.COMPLETED
    ).length;

    return Math.round((completedStages / totalStages) * 100);
  },

  _calculateDuration(pipelineDataEntry: PipelineData): number {
    const endTime = pipelineDataEntry.completedAt || pipelineDataEntry.failedAt || new Date().toISOString();
    return Date.parse(endTime) - Date.parse(pipelineDataEntry.createdAt);
  },

  storeAgentExecution(taskId: string, agent: string, executionInfo: Record<string, unknown>): PipelineData {
    const pipelines = this.load();
    const pipelineDataEntry = pipelines[taskId];

    if (!pipelineDataEntry) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    if (!pipelineDataEntry.metadata.agentExecution) {
      pipelineDataEntry.metadata.agentExecution = {
        gemini: null,
        claude: null,
        codex: null
      };
    }

    pipelineDataEntry.metadata.agentExecution[agent as 'gemini' | 'claude' | 'codex'] = {
      ...executionInfo,
      startedAt: executionInfo.startedAt || new Date().toISOString()
    };

    pipelineDataEntry.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineDataEntry;
  },

  getAgentExecution(taskId: string, agent: string | null = null): unknown {
    const pipelineDataEntry = this.get(taskId);

    if (!pipelineDataEntry) {
      return null;
    }

    if (!pipelineDataEntry.metadata.agentExecution) {
      return null;
    }

    if (agent) {
      return pipelineDataEntry.metadata.agentExecution[agent as 'gemini' | 'claude' | 'codex'];
    }

    return pipelineDataEntry.metadata.agentExecution;
  }
};
