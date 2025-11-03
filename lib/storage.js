const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { jarvis, colors } = require('./ui');

// ============================================
// FILE PATHS
// ============================================

const FILES = {
  cache: config.files.cacheFile,
  queue: config.files.queueFile,
  prTracking: config.files.prTrackingFile,
  pipeline: config.files.pipelineFile,
};

// ============================================
// CACHE MANAGEMENT
// ============================================

let processedTasksData = [];
let processedTaskIds = new Set();

const cache = {
  load() {
    try {
      if (fs.existsSync(FILES.cache)) {
        const data = JSON.parse(fs.readFileSync(FILES.cache, 'utf8'));
        if (data.length > 0 && typeof data[0] === 'string') {
          return data.map(id => ({ id, title: 'Unknown', description: '', detectedAt: new Date().toISOString() }));
        }
        return data;
      }
    } catch (error) {
      console.error('Error loading cache:', error.message);
    }
    return [];
  },

  save() {
    try {
      fs.writeFileSync(FILES.cache, JSON.stringify(processedTasksData, null, 2));
    } catch (error) {
      console.error('Error saving cache:', error.message);
    }
  },

  add(task) {
    if (!processedTaskIds.has(task.id)) {
      processedTasksData.push({
        id: task.id,
        title: task.name,
        description: task.description || task.text_content || '',
        detectedAt: new Date().toISOString()
      });
      processedTaskIds.add(task.id);
      this.save();
    }
  },

  has(taskId) {
    return processedTaskIds.has(taskId);
  },

  init() {
    processedTasksData = this.load();
    processedTaskIds = new Set(processedTasksData.map(t => t.id));
  },

  getData() {
    return processedTasksData;
  },

  getIds() {
    return processedTaskIds;
  }
};

// ============================================
// QUEUE MANAGEMENT
// ============================================

const queue = {
  load() {
    try {
      if (fs.existsSync(FILES.queue)) {
        return JSON.parse(fs.readFileSync(FILES.queue, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading queue:', error.message);
    }
    return { pending: [], completed: [] };
  },

  save(queueData) {
    try {
      fs.writeFileSync(FILES.queue, JSON.stringify(queueData, null, 2));
    } catch (error) {
      console.error('Error saving queue:', error.message);
    }
  },

  async add(task) {
    const taskId = task.id;
    const taskTitle = task.name;
    const taskDescription = task.description || task.text_content || 'No description provided';

    const queueData = this.load();

    if (queueData.pending.find(t => t.id === taskId)) {
      console.log(jarvis.warning(`Task ${taskId} already queued`));
      return { alreadyQueued: true };
    }

    console.log(jarvis.info(`Queued task ${colors.bright}${taskId}${colors.reset}`));

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
      prBody: `## ClickUp Task\n\n**Task:** ${taskTitle}\n**ID:** ${taskId}\n**URL:** ${task.url}\n\n## Description\n\n${taskDescription}\n\n---\n\n🤖 Queued by Devin for processing`
    });

    this.save(queueData);
    return { success: true };
  },

  getPending() {
    return this.load().pending;
  },

  getCompleted() {
    return this.load().completed;
  }
};

// ============================================
// PR TRACKING
// ============================================

let prTrackingData = [];

// ============================================
// REVIEW CYCLE TRACKING
// ============================================

let reviewTrackingData = [];

const tracking = {
  load() {
    try {
      if (fs.existsSync(FILES.prTracking)) {
        return JSON.parse(fs.readFileSync(FILES.prTracking, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading PR tracking:', error.message);
    }
    return [];
  },

  save(data) {
    try {
      fs.writeFileSync(FILES.prTracking, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving PR tracking:', error.message);
    }
  },

  start(task) {
    const trackingEntry = {
      taskId: task.id,
      taskName: task.name,
      branch: `task-${task.id}`,
      startedAt: new Date().toISOString(),
      owner: config.github.owner,
      repo: config.github.repo
    };

    prTrackingData.push(trackingEntry);
    this.save(prTrackingData);
    console.log(jarvis.info(`Started PR tracking for task ${task.id}`));
  },

  async checkForPR(trackingEntry) {
    try {
      // Use gh CLI with its own keyring authentication (don't override with GITHUB_TOKEN)
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

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
    } catch (error) {
      // Silently handle "no PR found" cases - this is expected while waiting for PR creation
      // Only log actual errors (not empty results)
      if (error.code !== 0 && !error.message.includes('no pull requests')) {
        console.error(`Error checking PR for ${trackingEntry.taskId}:`, error.message);
      }
    }

    // Silently return false - PR doesn't exist yet
    return { found: false };
  },

  async poll(clickupModule, options = {}) {
    const now = new Date();
    const onPRFound = options.onPRFound; // Callback when PR is found

    for (let i = prTrackingData.length - 1; i >= 0; i--) {
      const trackingEntry = prTrackingData[i];
      const startedAt = new Date(trackingEntry.startedAt);
      const elapsed = now - startedAt;

      if (elapsed > config.prTracking.timeoutMs) {
        console.log(jarvis.warning(`Task ${colors.bright}${trackingEntry.taskId}${colors.reset} timeout (30min)`));

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
        console.log(jarvis.success(`Task ${colors.bright}${trackingEntry.taskId}${colors.reset} → PR #${result.number}`));
        console.log(jarvis.info(result.url));

        await clickupModule.addComment(
          trackingEntry.taskId,
          `✅ **Pull Request Created**\n\n` +
          `**PR #${result.number}:** ${result.url}\n\n` +
          `Implementation complete and ready for review.`
        );

        await clickupModule.updateStatus(trackingEntry.taskId, 'can be checked');

        // Trigger review workflow if callback is provided
        if (onPRFound) {
          await onPRFound({
            taskId: trackingEntry.taskId,
            taskName: trackingEntry.taskName,
            prNumber: result.number,
            prUrl: result.url,
            branch: trackingEntry.branch
          });
        }

        prTrackingData.splice(i, 1);
        this.save(prTrackingData);
      }
    }
  },

  init() {
    prTrackingData = this.load();
  },

  getData() {
    return prTrackingData;
  }
};

// ============================================
// REVIEW CYCLE TRACKING
// ============================================

const reviewTracking = {
  load() {
    try {
      const reviewFile = path.join(__dirname, '..', 'review-tracking.json');
      if (fs.existsSync(reviewFile)) {
        return JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading review tracking:', error.message);
    }
    return [];
  },

  save(data) {
    try {
      const reviewFile = path.join(__dirname, '..', 'review-tracking.json');
      fs.writeFileSync(reviewFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving review tracking:', error.message);
    }
  },

  startReviewCycle(task, prInfo) {
    const reviewEntry = {
      taskId: task.id,
      taskName: task.name,
      branch: prInfo.branch || `task-${task.id}`,
      prNumber: prInfo.prNumber,
      prUrl: prInfo.prUrl,
      stage: 'waiting_for_codex_review', // waiting_for_codex_review, waiting_for_claude_fixes, completed
      iteration: 0,
      maxIterations: 3,
      startedAt: new Date().toISOString(),
      lastCommitSha: null,
      owner: config.github.owner,
      repo: config.github.repo
    };

    reviewTrackingData.push(reviewEntry);
    this.save(reviewTrackingData);
    console.log(jarvis.info(`Started review cycle for task ${task.id}`));
  },

  async checkForNewCommit(reviewEntry) {
    try {
      // Use gh CLI with its own keyring authentication (don't override with GITHUB_TOKEN)
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

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
    } catch (error) {
      // Silently handle errors - branch might not exist yet or no commits
      // Only log if it's an actual API error (not 404/empty results)
      if (!error.message.includes('404') && !error.message.includes('Not Found')) {
        console.error(`Error checking commits for ${reviewEntry.taskId}:`, error.message);
      }
    }

    return { isNew: false };
  },

  async poll(clickupModule, codexModule, claudeModule) {
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
      reviewEntry.lastCommitSha = commitResult.sha;

      if (reviewEntry.stage === 'waiting_for_codex_review' && commitResult.isReview) {
        // Codex review commit detected!
        console.log(jarvis.success(`Codex review complete for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        console.log(jarvis.info(`Commit: ${commitResult.message}`));

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

        console.log(jarvis.ai(`Triggering Claude to fix TODOs for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        const task = { id: reviewEntry.taskId, name: reviewEntry.taskName };
        await claudeModule.fixTodoComments(task);

      } else if (reviewEntry.stage === 'waiting_for_claude_fixes' && commitResult.isFix) {
        // Claude fixes commit detected!
        console.log(jarvis.success(`Claude fixes complete for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        console.log(jarvis.info(`Commit: ${commitResult.message}`));

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

          console.log(jarvis.ai(`Starting review iteration ${reviewEntry.iteration + 1} for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
          const task = { id: reviewEntry.taskId, name: reviewEntry.taskName };
          await codexModule.reviewClaudeChanges(task);
        } else {
          // Review cycle complete
          console.log(jarvis.success(`Review cycle complete for ${colors.bright}${reviewEntry.taskId}${colors.reset} (${reviewEntry.iteration} iterations)`));

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

  init() {
    reviewTrackingData = this.load();
  },

  getData() {
    return reviewTrackingData;
  }
};

// ============================================
// PIPELINE MANAGEMENT
// ============================================

// Pipeline stage definitions
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

  load() {
    try {
      if (fs.existsSync(FILES.pipeline)) {
        return JSON.parse(fs.readFileSync(FILES.pipeline, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading pipelines:', error.message);
    }
    return {};
  },

  save(pipelines) {
    try {
      fs.writeFileSync(FILES.pipeline, JSON.stringify(pipelines, null, 2));
    } catch (error) {
      console.error('Error saving pipelines:', error.message);
    }
  },

  init(taskId, taskData = {}) {
    const pipelines = this.load();

    const pipelineData = {
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
        maxReviewIterations: 3
      },
      errors: []
    };

    pipelines[taskId] = pipelineData;
    this.save(pipelines);

    return pipelineData;
  },

  get(taskId) {
    const pipelines = this.load();
    return pipelines[taskId] || null;
  },

  updateStage(taskId, stage, stageData = {}) {
    const pipelines = this.load();
    const pipelineData = pipelines[taskId];

    if (!pipelineData) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    let stageEntry = pipelineData.stages.find(s => s.stage === stage);

    if (!stageEntry) {
      stageEntry = {
        name: stageData.name || stage,
        stage,
        status: STATUS.IN_PROGRESS,
        startedAt: new Date().toISOString()
      };
      pipelineData.stages.push(stageEntry);
    } else {
      stageEntry.status = STATUS.IN_PROGRESS;
      stageEntry.startedAt = new Date().toISOString();
    }

    Object.assign(stageEntry, stageData);

    pipelineData.currentStage = stage;
    pipelineData.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineData;
  },

  completeStage(taskId, stage, result = {}) {
    const pipelines = this.load();
    const pipelineData = pipelines[taskId];

    if (!pipelineData) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    const stageEntry = pipelineData.stages.find(s => s.stage === stage);

    if (stageEntry) {
      stageEntry.status = STATUS.COMPLETED;
      stageEntry.completedAt = new Date().toISOString();
      stageEntry.duration = Date.parse(stageEntry.completedAt) - Date.parse(stageEntry.startedAt);
      Object.assign(stageEntry, result);
    }

    pipelineData.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineData;
  },

  failStage(taskId, stage, error) {
    const pipelines = this.load();
    const pipelineData = pipelines[taskId];

    if (!pipelineData) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    const stageEntry = pipelineData.stages.find(s => s.stage === stage);

    if (stageEntry) {
      stageEntry.status = STATUS.FAILED;
      stageEntry.completedAt = new Date().toISOString();
      stageEntry.error = error.message || String(error);
    }

    pipelineData.errors.push({
      stage,
      error: error.message || String(error),
      timestamp: new Date().toISOString()
    });

    pipelineData.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineData;
  },

  updateMetadata(taskId, metadata) {
    const pipelines = this.load();
    const pipelineData = pipelines[taskId];

    if (!pipelineData) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    pipelineData.metadata = {
      ...pipelineData.metadata,
      ...metadata
    };

    pipelineData.updatedAt = new Date().toISOString();

    this.save(pipelines);
    return pipelineData;
  },

  complete(taskId, result = {}) {
    const pipelines = this.load();
    const pipelineData = pipelines[taskId];

    if (!pipelineData) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    pipelineData.status = STATUS.COMPLETED;
    pipelineData.currentStage = STAGES.COMPLETED;
    pipelineData.completedAt = new Date().toISOString();
    pipelineData.totalDuration = Date.parse(pipelineData.completedAt) - Date.parse(pipelineData.createdAt);

    Object.assign(pipelineData.metadata, result);

    this.save(pipelines);
    return pipelineData;
  },

  fail(taskId, error) {
    const pipelines = this.load();
    const pipelineData = pipelines[taskId];

    if (!pipelineData) {
      throw new Error(`Pipeline not found for task ${taskId}`);
    }

    pipelineData.status = STATUS.FAILED;
    pipelineData.currentStage = STAGES.FAILED;
    pipelineData.failedAt = new Date().toISOString();
    pipelineData.errors.push({
      stage: pipelineData.currentStage,
      error: error.message || String(error),
      timestamp: new Date().toISOString()
    });

    this.save(pipelines);
    return pipelineData;
  },

  getActive() {
    const pipelines = this.load();
    return Object.values(pipelines).filter(
      p => p.status === STATUS.IN_PROGRESS
    );
  },

  cleanup(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
    const pipelines = this.load();
    const cutoffTime = Date.now() - olderThanMs;
    let cleaned = 0;

    for (const [taskId, pipelineData] of Object.entries(pipelines)) {
      const completedAt = pipelineData.completedAt || pipelineData.failedAt;
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

  getSummary(taskId) {
    const pipelineData = this.get(taskId);

    if (!pipelineData) {
      return null;
    }

    return {
      taskId: pipelineData.taskId,
      taskName: pipelineData.taskName,
      currentStage: pipelineData.currentStage,
      status: pipelineData.status,
      progress: this._calculateProgress(pipelineData),
      duration: this._calculateDuration(pipelineData),
      reviewIterations: pipelineData.metadata.reviewIterations || 0,
      hasErrors: pipelineData.errors.length > 0
    };
  },

  _calculateProgress(pipelineData) {
    const totalStages = 10;
    const completedStages = pipelineData.stages.filter(
      s => s.status === STATUS.COMPLETED
    ).length;

    return Math.round((completedStages / totalStages) * 100);
  },

  _calculateDuration(pipelineData) {
    const endTime = pipelineData.completedAt || pipelineData.failedAt || new Date().toISOString();
    return Date.parse(endTime) - Date.parse(pipelineData.createdAt);
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  cache,
  queue,
  tracking,
  reviewTracking,
  pipeline
};
