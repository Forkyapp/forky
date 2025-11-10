import fs from 'fs';
import path from 'path';
import config, { resolveRepoConfig } from './config';
import { forky, colors } from './ui';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================
// INTERFACES
// ============================================

interface TaskData {
  id: string;
  name: string;
  title?: string;
  description?: string;
  text_content?: string;
  url?: string;
}

interface ProcessedTask {
  id: string;
  title: string;
  description: string;
  detectedAt: string;
}

interface QueueData {
  pending: QueuedTask[];
  completed: QueuedTask[];
}

interface QueuedTask {
  id: string;
  title: string;
  description: string;
  url?: string;
  queuedAt: string;
  repoPath?: string;
  owner?: string;
  repo?: string;
  branch: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

interface TrackingEntry {
  taskId: string;
  taskName: string;
  branch: string;
  startedAt: string;
  owner?: string;
  repo?: string;
}

interface PRCheckResult {
  found: boolean;
  url?: string;
  number?: number;
  state?: string;
}

interface PRFoundInfo {
  taskId: string;
  taskName: string;
  prNumber: number;
  prUrl: string;
  branch: string;
}

interface ReviewEntry {
  taskId: string;
  taskName: string;
  branch: string;
  prNumber: number;
  prUrl: string;
  stage: string;
  iteration: number;
  maxIterations: number;
  startedAt: string;
  lastCommitSha: string | null;
  repository?: string;
  owner?: string;
  repo?: string;
  repoPath?: string;
}

interface CommitCheckResult {
  isNew: boolean;
  sha?: string;
  message?: string;
  isReview?: boolean;
  isFix?: boolean;
}

interface StageEntry {
  name: string;
  stage: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  [key: string]: any;
}

interface PipelineData {
  taskId: string;
  taskName: string;
  currentStage: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  totalDuration?: number;
  stages: StageEntry[];
  metadata: {
    geminiAnalysis?: any;
    aiInstances?: any[];
    branches?: any[];
    prNumber?: number | null;
    reviewIterations?: number;
    maxReviewIterations?: number;
    agentExecution?: {
      gemini?: any;
      claude?: any;
      codex?: any;
    };
    repository?: string;
    [key: string]: any;
  };
  errors: Array<{
    stage: string;
    error: string;
    timestamp: string;
  }>;
}

interface PipelineSummary {
  taskId: string;
  taskName: string;
  currentStage: string;
  status: string;
  progress: number;
  duration: number;
  reviewIterations: number;
  hasErrors: boolean;
}

interface RepoConfig {
  owner: string;
  repo: string;
  path: string;
  baseBranch?: string;
  token?: string;
}

// ============================================
// FILE PATHS
// ============================================

const FILES = {
  cache: config.files.cacheFile,
  queue: config.files.queueFile,
  prTracking: config.files.prTrackingFile,
  pipeline: config.files.pipelineFile,
  processedComments: path.join(__dirname, '..', 'processed-comments.json'),
};

// ============================================
// CACHE MANAGEMENT
// ============================================

let processedTasksData: ProcessedTask[] = [];
let processedTaskIds = new Set<string>();

const cache = {
  load(): ProcessedTask[] {
    try {
      if (fs.existsSync(FILES.cache)) {
        const data = JSON.parse(fs.readFileSync(FILES.cache, 'utf8'));
        if (data.length > 0 && typeof data[0] === 'string') {
          return data.map((id: string) => ({
            id,
            title: 'Unknown',
            description: '',
            detectedAt: new Date().toISOString()
          }));
        }
        return data;
      }
    } catch (error) {
      console.error('Error loading cache:', (error as Error).message);
    }
    return [];
  },

  save(): void {
    try {
      fs.writeFileSync(FILES.cache, JSON.stringify(processedTasksData, null, 2));
    } catch (error) {
      console.error('Error saving cache:', (error as Error).message);
    }
  },

  add(task: TaskData): void {
    if (!processedTaskIds.has(task.id)) {
      processedTasksData.push({
        id: task.id,
        title: task.name || task.title || '',
        description: task.description || task.text_content || '',
        detectedAt: new Date().toISOString()
      });
      processedTaskIds.add(task.id);
      this.save();
    }
  },

  has(taskId: string): boolean {
    return processedTaskIds.has(taskId);
  },

  init(): void {
    processedTasksData = this.load();
    processedTaskIds = new Set(processedTasksData.map(t => t.id));
  },

  getData(): ProcessedTask[] {
    return processedTasksData;
  },

  getIds(): Set<string> {
    return processedTaskIds;
  }
};

// ============================================
// QUEUE MANAGEMENT
// ============================================

const queue = {
  load(): QueueData {
    try {
      if (fs.existsSync(FILES.queue)) {
        return JSON.parse(fs.readFileSync(FILES.queue, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading queue:', (error as Error).message);
    }
    return { pending: [], completed: [] };
  },

  save(queueData: QueueData): void {
    try {
      fs.writeFileSync(FILES.queue, JSON.stringify(queueData, null, 2));
    } catch (error) {
      console.error('Error saving queue:', (error as Error).message);
    }
  },

  async add(task: TaskData): Promise<{ alreadyQueued?: boolean; success?: boolean }> {
    const taskId = task.id;
    const taskTitle = task.name || task.title || '';
    const taskDescription = task.description || task.text_content || 'No description provided';

    const queueData = this.load();

    if (queueData.pending.find(t => t.id === taskId)) {
      console.log(forky.warning(`Task ${taskId} already queued`));
      return { alreadyQueued: true };
    }

    console.log(forky.info(`Queued task ${colors.bright}${taskId}${colors.reset}`));

    queueData.pending.push({
      id: taskId,
      title: taskTitle,
      description: taskDescription,
      url: task.url,
      queuedAt: new Date().toISOString(),
      repoPath: config.github.repoPath,
      owner: config.github.owner,
      repo: config.github.repo,
      branch: `task-${taskId}`,
      commitMessage: `feat: ${taskTitle} (#${taskId})`,
      prTitle: `[ClickUp #${taskId}] ${taskTitle}`,
      prBody: `## ClickUp Task\n\n**Task:** ${taskTitle}\n**ID:** ${taskId}\n**URL:** ${task.url}\n\n## Description\n\n${taskDescription}\n\n---\n\n🤖 Queued by Forky for processing`
    });

    this.save(queueData);
    return { success: true };
  },

  getPending(): QueuedTask[] {
    return this.load().pending;
  },

  getCompleted(): QueuedTask[] {
    return this.load().completed;
  }
};

// ============================================
// PR TRACKING
// ============================================

let prTrackingData: TrackingEntry[] = [];
let pipelineData: Record<string, PipelineData> = {};

const tracking = {
  load(): TrackingEntry[] {
    try {
      if (fs.existsSync(FILES.prTracking)) {
        return JSON.parse(fs.readFileSync(FILES.prTracking, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading PR tracking:', (error as Error).message);
    }
    return [];
  },

  save(data: TrackingEntry[]): void {
    try {
      fs.writeFileSync(FILES.prTracking, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving PR tracking:', (error as Error).message);
    }
  },

  start(task: TaskData): void {
    const trackingEntry: TrackingEntry = {
      taskId: task.id,
      taskName: task.name || task.title || '',
      branch: `task-${task.id}`,
      startedAt: new Date().toISOString(),
      owner: config.github.owner,
      repo: config.github.repo
    };

    prTrackingData.push(trackingEntry);
    this.save(prTrackingData);
    console.log(forky.info(`Started PR tracking for task ${task.id}`));
  },

  async checkForPR(trackingEntry: TrackingEntry): Promise<PRCheckResult> {
    try {
      // Remove GITHUB_TOKEN/GH_TOKEN from env to let gh use keyring
      const cleanEnv = { ...process.env };
      delete cleanEnv.GITHUB_TOKEN;
      delete cleanEnv.GH_TOKEN;

      const { stdout } = await execAsync(
        `gh pr list --repo ${trackingEntry.owner}/${trackingEntry.repo} --head ${trackingEntry.branch} --state all --json number,url,state --limit 1`,
        {
          timeout: 10000,
          env: cleanEnv
        }
      );

      const prs = JSON.parse(stdout);

      if (prs && prs.length > 0) {
        const pr = prs[0];
        return {
          found: true,
          url: pr.url,
          number: pr.number,
          state: pr.state
        };
      }
    } catch (error: any) {
      // Silently handle "no PR found" cases - this is expected while waiting for PR creation
      if (error.code !== 0 && !error.message.includes('no pull requests')) {
        console.error(`Error checking PR for ${trackingEntry.taskId}:`, error.message);
      }
    }

    return { found: false };
  },

  async poll(clickupModule: any, options: { onPRFound?: (info: PRFoundInfo) => Promise<void> } = {}): Promise<void> {
    const now = new Date();
    const onPRFound = options.onPRFound;

    for (let i = prTrackingData.length - 1; i >= 0; i--) {
      const trackingEntry = prTrackingData[i];
      const startedAt = new Date(trackingEntry.startedAt);
      const elapsed = now.getTime() - startedAt.getTime();

      if (elapsed > config.prTracking.timeoutMs) {
        console.log(forky.warning(`Task ${colors.bright}${trackingEntry.taskId}${colors.reset} timeout (30min)`));

        await clickupModule.addComment(
          trackingEntry.taskId,
          `⚠️ **Timeout Warning**\n\n` +
          `No Pull Request detected after 30 minutes.\n\n` +
          `Check terminal for agent status.`
        );

        prTrackingData.splice(i, 1);
        this.save(prTrackingData);
        continue;
      }

      const result = await this.checkForPR(trackingEntry);

      if (result.found) {
        console.log(forky.success(`Task ${colors.bright}${trackingEntry.taskId}${colors.reset} → PR #${result.number}`));
        console.log(forky.info(result.url!));

        try {
          await clickupModule.addComment(
            trackingEntry.taskId,
            `✅ **Pull Request Created**\n\n` +
            `**PR #${result.number}:** ${result.url}\n\n` +
            `Implementation complete and ready for review.`
          );
        } catch (error) {
          console.error(`Failed to add ClickUp comment:`, (error as Error).message);
        }

        try {
          await clickupModule.updateStatus(trackingEntry.taskId, 'can be checked');
        } catch (error) {
          console.error(`Failed to update ClickUp status:`, (error as Error).message);
        }

        // Remove tracking entry FIRST to prevent duplicate triggers
        prTrackingData.splice(i, 1);
        this.save(prTrackingData);

        // Trigger review workflow if callback is provided
        if (onPRFound) {
          await onPRFound({
            taskId: trackingEntry.taskId,
            taskName: trackingEntry.taskName,
            prNumber: result.number!,
            prUrl: result.url!,
            branch: trackingEntry.branch
          });
        }
      }
    }
  },

  init(): void {
    prTrackingData = this.load();
  },

  getData(): TrackingEntry[] {
    return prTrackingData;
  }
};

// ============================================
// REVIEW CYCLE TRACKING
// ============================================

let reviewTrackingData: ReviewEntry[] = [];

const reviewTracking = {
  load(): ReviewEntry[] {
    try {
      const reviewFile = path.join(__dirname, '..', 'review-tracking.json');
      if (fs.existsSync(reviewFile)) {
        return JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading review tracking:', (error as Error).message);
    }
    return [];
  },

  save(data: ReviewEntry[]): void {
    try {
      const reviewFile = path.join(__dirname, '..', 'review-tracking.json');
      fs.writeFileSync(reviewFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving review tracking:', (error as Error).message);
    }
  },

  startReviewCycle(task: TaskData, prInfo: Partial<PRFoundInfo>): boolean {
    // Check if review cycle already exists for this task
    const existing = reviewTrackingData.find(r => r.taskId === task.id);
    if (existing) {
      console.log(forky.warning(`Review cycle already exists for task ${task.id}`));
      return false;
    }

    // Get repository from pipeline state if available
    const pipelineEntry = pipelineData[task.id];
    const repoName = pipelineEntry?.metadata?.repository || 'default';
    const repoConfig = resolveRepoConfig(repoName === 'default' ? null : repoName);

    const reviewEntry: ReviewEntry = {
      taskId: task.id,
      taskName: task.name || task.title || '',
      branch: prInfo.branch || `task-${task.id}`,
      prNumber: prInfo.prNumber || 0,
      prUrl: prInfo.prUrl || '',
      stage: 'waiting_for_codex_review',
      iteration: 0,
      maxIterations: 3,
      startedAt: new Date().toISOString(),
      lastCommitSha: null,
      repository: repoName,
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      repoPath: repoConfig.path
    };

    reviewTrackingData.push(reviewEntry);
    this.save(reviewTrackingData);
    console.log(forky.info(`Started review cycle for task ${task.id} (repo: ${repoName})`));
    return true;
  },

  async checkForNewCommit(reviewEntry: ReviewEntry): Promise<CommitCheckResult> {
    try {
      // Remove GITHUB_TOKEN/GH_TOKEN from env to let gh use keyring
      const cleanEnv = { ...process.env };
      delete cleanEnv.GITHUB_TOKEN;
      delete cleanEnv.GH_TOKEN;

      const { stdout } = await execAsync(
        `gh api repos/${reviewEntry.owner}/${reviewEntry.repo}/commits?sha=${reviewEntry.branch}&per_page=1`,
        {
          timeout: 10000,
          env: cleanEnv
        }
      );

      const commits = JSON.parse(stdout);

      if (commits && commits.length > 0) {
        const latestCommit = commits[0];
        const latestSha = latestCommit.sha;
        const commitMessage = latestCommit.commit.message;

        // Check if this is a new commit
        if (reviewEntry.lastCommitSha && latestSha !== reviewEntry.lastCommitSha) {
          return {
            isNew: true,
            sha: latestSha,
            message: commitMessage,
            isReview: commitMessage.includes('review:') || commitMessage.includes('TODO'),
            isFix: commitMessage.includes('fix:') && commitMessage.includes('TODO')
          };
        } else if (!reviewEntry.lastCommitSha) {
          // First check - just record the SHA
          return {
            isNew: false,
            sha: latestSha,
            message: commitMessage
          };
        }
      }
    } catch (error: any) {
      if (!error.message.includes('404') && !error.message.includes('Not Found')) {
        console.error(`Error checking commits for ${reviewEntry.taskId}:`, error.message);
      }
    }

    return { isNew: false };
  },

  async poll(clickupModule: any, codexModule: any, claudeModule: any): Promise<void> {
    for (let i = reviewTrackingData.length - 1; i >= 0; i--) {
      const reviewEntry = reviewTrackingData[i];

      const commitResult = await this.checkForNewCommit(reviewEntry);

      // Initialize lastCommitSha on first check
      if (!reviewEntry.lastCommitSha && commitResult.sha) {
        reviewEntry.lastCommitSha = commitResult.sha;
        this.save(reviewTrackingData);
        continue;
      }

      if (!commitResult.isNew) continue;

      // Update the SHA
      reviewEntry.lastCommitSha = commitResult.sha!;

      if (reviewEntry.stage === 'waiting_for_codex_review' && commitResult.isReview) {
        // Codex review commit detected!
        console.log(forky.success(`Codex review complete for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        console.log(forky.info(`Commit: ${commitResult.message}`));

        await clickupModule.addComment(
          reviewEntry.taskId,
          `👀 **Code Review Complete**\n\n` +
          `Codex has reviewed the code and added TODO comments.\n\n` +
          `**Next:** Claude will now fix the TODO comments.`
        );

        // Trigger Claude fixes
        reviewEntry.stage = 'waiting_for_claude_fixes';
        reviewEntry.iteration++;
        this.save(reviewTrackingData);

        console.log(forky.ai(`Triggering Claude to fix TODOs for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        const task = { id: reviewEntry.taskId, name: reviewEntry.taskName };
        const repoConfig = {
          owner: reviewEntry.owner!,
          repo: reviewEntry.repo!,
          path: reviewEntry.repoPath!
        };
        await claudeModule.fixTodoComments(task, { repoConfig });

      } else if (reviewEntry.stage === 'waiting_for_claude_fixes' && commitResult.isFix) {
        // Claude fixes commit detected!
        console.log(forky.success(`Claude fixes complete for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        console.log(forky.info(`Commit: ${commitResult.message}`));

        await clickupModule.addComment(
          reviewEntry.taskId,
          `🔧 **TODO Comments Fixed**\n\n` +
          `Claude has addressed all TODO comments from the review.\n\n` +
          `**Iteration:** ${reviewEntry.iteration}/${reviewEntry.maxIterations}`
        );

        // Check if we should do another review iteration
        if (reviewEntry.iteration < reviewEntry.maxIterations) {
          // Trigger another Codex review
          reviewEntry.stage = 'waiting_for_codex_review';
          this.save(reviewTrackingData);

          console.log(forky.ai(`Starting review iteration ${reviewEntry.iteration + 1} for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
          const task = { id: reviewEntry.taskId, name: reviewEntry.taskName };
          const repoConfig = {
            owner: reviewEntry.owner!,
            repo: reviewEntry.repo!,
            path: reviewEntry.repoPath!
          };
          await codexModule.reviewClaudeChanges(task, { repoConfig });
        } else {
          // Review cycle complete
          console.log(forky.success(`Review cycle complete for ${colors.bright}${reviewEntry.taskId}${colors.reset} (${reviewEntry.iteration} iterations)`));

          await clickupModule.addComment(
            reviewEntry.taskId,
            `✅ **Review Cycle Complete**\n\n` +
            `All review iterations finished. PR is ready for final review!\n\n` +
            `**Total Iterations:** ${reviewEntry.iteration}\n` +
            `**PR:** ${reviewEntry.prUrl}`
          );

          // Remove from tracking
          reviewTrackingData.splice(i, 1);
          this.save(reviewTrackingData);
        }
      }

      this.save(reviewTrackingData);
    }
  },

  init(): void {
    reviewTrackingData = this.load();
  },

  getData(): ReviewEntry[] {
    return reviewTrackingData;
  }
};

// ============================================
// PIPELINE MANAGEMENT
// ============================================

const STAGES = {
  DETECTED: 'detected',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  IMPLEMENTING: 'implementing',
  IMPLEMENTED: 'implemented',
  CODEX_REVIEWING: 'codex_reviewing',
  CODEX_REVIEWED: 'codex_reviewed',
  CLAUDE_FIXING: 'claude_fixing',
  CLAUDE_FIXED: 'claude_fixed',
  MERGING: 'merging',
  MERGED: 'merged',
  PR_CREATING: 'pr_creating',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

const pipeline = {
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
      taskName: taskData.name || taskData.title || '',
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
    pipelineData = pipelines;
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

  completeStage(taskId: string, stage: string, result: any = {}): PipelineData {
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

  updateMetadata(taskId: string, metadata: Record<string, any>): PipelineData {
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

  complete(taskId: string, result: any = {}): PipelineData {
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

  storeAgentExecution(taskId: string, agent: string, executionInfo: any): PipelineData {
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

  getAgentExecution(taskId: string, agent: string | null = null): any {
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

// ============================================
// PROCESSED COMMENTS TRACKING
// ============================================

let processedCommentsSet = new Set<string>();

const processedComments = {
  load(): void {
    try {
      if (fs.existsSync(FILES.processedComments)) {
        const data = JSON.parse(fs.readFileSync(FILES.processedComments, 'utf8'));
        processedCommentsSet = new Set(data);
      }
    } catch (error) {
      console.error('Error loading processed comments:', (error as Error).message);
    }
  },

  save(): void {
    try {
      fs.writeFileSync(FILES.processedComments, JSON.stringify([...processedCommentsSet], null, 2));
    } catch (error) {
      console.error('Error saving processed comments:', (error as Error).message);
    }
  },

  has(commentId: string): boolean {
    return processedCommentsSet.has(commentId);
  },

  add(commentId: string): void {
    processedCommentsSet.add(commentId);
    this.save();
  },

  init(): void {
    this.load();
  }
};

// ============================================
// EXPORTS
// ============================================

export {
  cache,
  queue,
  tracking,
  reviewTracking,
  pipeline,
  processedComments,
  TaskData,
  ProcessedTask,
  QueueData,
  QueuedTask,
  TrackingEntry,
  PRCheckResult,
  PRFoundInfo,
  ReviewEntry,
  CommitCheckResult,
  StageEntry,
  PipelineData,
  PipelineSummary,
  RepoConfig
};
