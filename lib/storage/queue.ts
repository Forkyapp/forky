import fs from 'fs';
import config from '../config';
import { forky, colors } from '../ui';
import type { TaskData, QueueData, QueuedTask } from '../types';

const FILES = {
  queue: config.files.queueFile
};

export const queue = {
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
