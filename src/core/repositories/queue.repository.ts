/**
 * Queue Repository
 * Manages task processing queue
 */

import fs from 'fs';
import { QueueData, QueuedTask, ClickUpTaskData } from '../../types';
import { FileReadError, FileWriteError } from '../../shared/errors';

export interface IQueueRepository {
  load(): Promise<QueueData>;
  save(data: QueueData): Promise<void>;
  add(task: ClickUpTaskData, config: { repoPath?: string; owner?: string; repo?: string }): Promise<{ success?: boolean; alreadyQueued?: boolean }>;
  getPending(): Promise<QueuedTask[]>;
  getCompleted(): Promise<QueuedTask[]>;
  moveToCompleted(taskId: string): Promise<void>;
  remove(taskId: string): Promise<void>;
}

export class QueueRepository implements IQueueRepository {
  constructor(private readonly filePath: string) {}

  /**
   * Load queue data from file
   */
  async load(): Promise<QueueData> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { pending: [], completed: [] };
      }

      const data = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  /**
   * Save queue data to file
   */
  async save(data: QueueData): Promise<void> {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Add task to pending queue
   */
  async add(
    task: ClickUpTaskData,
    config: { repoPath?: string; owner?: string; repo?: string }
  ): Promise<{ success?: boolean; alreadyQueued?: boolean }> {
    const queueData = await this.load();

    // Check if already queued
    if (queueData.pending.find((t) => t.id === task.id)) {
      return { alreadyQueued: true };
    }

    const queuedTask: QueuedTask = {
      id: task.id,
      title: task.name || task.title || '',
      description: task.description || task.text_content || 'No description provided',
      url: task.url,
      queuedAt: new Date().toISOString(),
      repoPath: config.repoPath,
      owner: config.owner,
      repo: config.repo,
      branch: `task-${task.id}`,
      commitMessage: `feat: ${task.name || task.title} (#${task.id})`,
      prTitle: `[ClickUp #${task.id}] ${task.name || task.title}`,
      prBody: `## ClickUp Task\n\n**Task:** ${task.name || task.title}\n**ID:** ${task.id}\n**URL:** ${task.url}\n\n## Description\n\n${task.description || task.text_content || 'No description provided'}\n\n---\n\n🤖 Queued by Forky for processing`,
    };

    queueData.pending.push(queuedTask);
    await this.save(queueData);

    return { success: true };
  }

  /**
   * Get pending tasks
   */
  async getPending(): Promise<QueuedTask[]> {
    const data = await this.load();
    return data.pending;
  }

  /**
   * Get completed tasks
   */
  async getCompleted(): Promise<QueuedTask[]> {
    const data = await this.load();
    return data.completed;
  }

  /**
   * Move task from pending to completed
   */
  async moveToCompleted(taskId: string): Promise<void> {
    const data = await this.load();
    const index = data.pending.findIndex((t) => t.id === taskId);

    if (index !== -1) {
      const [task] = data.pending.splice(index, 1);
      data.completed.push(task);
      await this.save(data);
    }
  }

  /**
   * Remove task from queue
   */
  async remove(taskId: string): Promise<void> {
    const data = await this.load();

    data.pending = data.pending.filter((t) => t.id !== taskId);
    data.completed = data.completed.filter((t) => t.id !== taskId);

    await this.save(data);
  }
}
