import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolveRepoConfig } from '../../src/shared/config';
import { timmy, colors } from '../../src/shared/ui';
import type { TaskData, ReviewEntry, PRFoundInfo, CommitCheckResult } from '../../src/types/storage';
import { pipeline } from './pipeline';

const execAsync = promisify(exec);

let reviewTrackingData: ReviewEntry[] = [];

const reviewTrackingFile = path.join(__dirname, '..', '..', 'data', 'tracking', 'review-tracking.json');

export const reviewTracking = {
  load(): ReviewEntry[] {
    try {
      if (fs.existsSync(reviewTrackingFile)) {
        return JSON.parse(fs.readFileSync(reviewTrackingFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading review tracking:', (error as Error).message);
    }
    return [];
  },

  save(data: ReviewEntry[]): void {
    try {
      fs.writeFileSync(reviewTrackingFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving review tracking:', (error as Error).message);
    }
  },

  startReviewCycle(task: TaskData, prInfo: Partial<PRFoundInfo>): boolean {
    // Check if review cycle already exists for this task
    const existing = reviewTrackingData.find(r => r.taskId === task.id);
    if (existing) {
      console.log(timmy.warning(`Review cycle already exists for task ${task.id}`));
      return false;
    }

    // Get repository from pipeline state if available
    const pipelineEntry = pipeline.get(task.id);
    const repoName = pipelineEntry?.metadata?.repository || 'default';
    const repoConfig = resolveRepoConfig(); // Uses workspace configuration

    const reviewEntry: ReviewEntry = {
      taskId: task.id,
      taskName: task.name || task.name || '',
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
    console.log(timmy.info(`Started review cycle for task ${task.id} (repo: ${repoName})`));
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
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (!err.message?.includes('404') && !err.message?.includes('Not Found')) {
        console.error(`Error checking commits for ${reviewEntry.taskId}:`, err.message);
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
        console.log(timmy.success(`Codex review complete for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        console.log(timmy.info(`Commit: ${commitResult.message}`));

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

        console.log(timmy.ai(`Triggering Claude to fix TODOs for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        const task = { id: reviewEntry.taskId, name: reviewEntry.taskName };
        const repoConfig = {
          owner: reviewEntry.owner!,
          repo: reviewEntry.repo!,
          path: reviewEntry.repoPath!
        };
        await claudeModule.fixTodoComments(task, { repoConfig });

      } else if (reviewEntry.stage === 'waiting_for_claude_fixes' && commitResult.isFix) {
        // Claude fixes commit detected!
        console.log(timmy.success(`Claude fixes complete for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
        console.log(timmy.info(`Commit: ${commitResult.message}`));

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

          console.log(timmy.ai(`Starting review iteration ${reviewEntry.iteration + 1} for ${colors.bright}${reviewEntry.taskId}${colors.reset}`));
          const task = { id: reviewEntry.taskId, name: reviewEntry.taskName };
          const repoConfig = {
            owner: reviewEntry.owner!,
            repo: reviewEntry.repo!,
            path: reviewEntry.repoPath!
          };
          await codexModule.reviewClaudeChanges(task, { repoConfig });
        } else {
          // Review cycle complete
          console.log(timmy.success(`Review cycle complete for ${colors.bright}${reviewEntry.taskId}${colors.reset} (${reviewEntry.iteration} iterations)`));

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
