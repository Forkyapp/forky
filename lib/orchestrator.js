const { jarvis, colors } = require('./ui');
const storage = require('./storage');
const gemini = require('./gemini');
const claude = require('./claude');
const codex = require('./codex');

/**
 * Process a task with multi-AI workflow (MVP: Sequential)
 *
 * Flow: Gemini Analysis → AI Implementation (Claude or Codex) → PR Creation
 */
async function processTask(task) {
  const taskId = task.id;
  const taskName = task.name;

  console.log(jarvis.ai(`Starting multi-AI workflow for ${colors.bright}${taskId}${colors.reset}`));

  // Initialize pipeline
  const pipelineState = storage.pipeline.init(taskId, { name: taskName });

  try {
    // Stage 1: Gemini Analysis
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.ANALYZING, { name: 'Gemini Analysis' });

    let analysis = null;
    let usedFallback = false;

    try {
      analysis = await gemini.analyzeTask(task);

      if (analysis.fallback) {
        usedFallback = true;
        console.log(jarvis.warning('Using fallback analysis'));
      }

      storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.ANALYZING, {
        featureSpecFile: analysis.featureSpecFile,
        fallback: usedFallback
      });

      storage.pipeline.updateMetadata(taskId, {
        geminiAnalysis: {
          file: analysis.featureSpecFile,
          fallback: usedFallback
        }
      });

    } catch (error) {
      console.log(jarvis.error(`Gemini analysis failed: ${error.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.ANALYZING, error);

      // Continue without analysis
      console.log(jarvis.info('Continuing without Gemini analysis'));
    }

    // Stage 2: Claude Implementation
    storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, { name: 'Claude Implementation' });

    try {
      const result = await claude.launchClaude(task, { analysis });

      if (result.success) {
        storage.pipeline.completeStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, {
          pid: result.pid,
          branch: `task-${taskId}`
        });

        storage.pipeline.updateMetadata(taskId, {
          aiProvider: 'claude',
          aiInstances: [{
            provider: 'claude',
            type: 'main',
            branch: `task-${taskId}`,
            pid: result.pid,
            startedAt: new Date().toISOString()
          }]
        });

        // Stage 3: PR Creation (handled by existing tracking system)
        storage.pipeline.updateStage(taskId, storage.pipeline.STAGES.PR_CREATING, { name: 'PR Creation' });
        storage.tracking.start(task);

        console.log(jarvis.success(`Multi-AI workflow initiated for ${colors.bright}${taskId}${colors.reset}`));

        return {
          success: true,
          pipeline: pipelineState,
          analysis: analysis || null
        };

      } else {
        // AI launch failed
        storage.pipeline.failStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, new Error(result.error || 'Claude launch failed'));
        storage.pipeline.fail(taskId, new Error('Implementation stage failed'));

        // Queue for manual processing
        await storage.queue.add(task);

        return {
          success: false,
          pipeline: pipelineState,
          error: result.error
        };
      }

    } catch (error) {
      console.log(jarvis.error(`Claude launch error: ${error.message}`));
      storage.pipeline.failStage(taskId, storage.pipeline.STAGES.IMPLEMENTING, error);
      storage.pipeline.fail(taskId, error);

      // Queue for manual processing
      await storage.queue.add(task);

      return {
        success: false,
        pipeline: pipelineState,
        error: error.message
      };
    }

  } catch (error) {
    console.log(jarvis.error(`Orchestration error: ${error.message}`));
    storage.pipeline.fail(taskId, error);

    // Queue for manual processing
    await storage.queue.add(task);

    return {
      success: false,
      pipeline: pipelineState,
      error: error.message
    };
  }
}

/**
 * Get pipeline status for a task
 */
function getTaskStatus(taskId) {
  return storage.pipeline.getSummary(taskId);
}

/**
 * Get all active tasks
 */
function getActiveTasks() {
  return storage.pipeline.getActive();
}

module.exports = {
  processTask,
  getTaskStatus,
  getActiveTasks
};
