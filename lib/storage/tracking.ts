import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../config';
import { forky, colors } from '../ui';
import type { TaskData, TrackingEntry, PRCheckResult, PRFoundInfo } from '../types';

const execAsync = promisify(exec);

let prTrackingData: TrackingEntry[] = [];

const FILES = {
  prTracking: config.files.prTrackingFile
};

export const tracking = {
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
