/**
 * Cache Repository
 * Manages processed tasks cache to prevent duplicate processing
 */

import fs from 'fs';
import path from 'path';
import { ProcessedTask, ClickUpTaskData } from '../../types';
import { FileReadError, FileWriteError, StorageError } from '../../shared/errors';

export interface ICacheRepository {
  load(): Promise<ProcessedTask[]>;
  save(tasks: ProcessedTask[]): Promise<void>;
  has(taskId: string): Promise<boolean>;
  add(task: ClickUpTaskData): Promise<void>;
  getAll(): Promise<ProcessedTask[]>;
  clear(): Promise<void>;
}

export class CacheRepository implements ICacheRepository {
  private tasks: ProcessedTask[] = [];
  private taskIds: Set<string> = new Set();

  constructor(private readonly filePath: string) {}

  /**
   * Load cached tasks from file
   */
  async load(): Promise<ProcessedTask[]> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }

      const data = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(data);

      // Handle legacy format (array of strings)
      if (parsed.length > 0 && typeof parsed[0] === 'string') {
        this.tasks = parsed.map((id: string) => ({
          id,
          title: 'Unknown',
          description: '',
          detectedAt: new Date().toISOString(),
        }));
      } else {
        this.tasks = parsed;
      }

      this.taskIds = new Set(this.tasks.map((t) => t.id));
      return this.tasks;
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  /**
   * Save cached tasks to file
   */
  async save(tasks: ProcessedTask[]): Promise<void> {
    try {
      this.tasks = tasks;
      this.taskIds = new Set(tasks.map((t) => t.id));
      fs.writeFileSync(this.filePath, JSON.stringify(tasks, null, 2));
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Check if task ID exists in cache
   */
  async has(taskId: string): Promise<boolean> {
    return this.taskIds.has(taskId);
  }

  /**
   * Add task to cache
   */
  async add(task: ClickUpTaskData): Promise<void> {
    if (this.taskIds.has(task.id)) {
      return; // Already cached
    }

    const processedTask: ProcessedTask = {
      id: task.id,
      title: task.name || task.title || '',
      description: task.description || task.text_content || '',
      detectedAt: new Date().toISOString(),
    };

    this.tasks.push(processedTask);
    this.taskIds.add(task.id);

    await this.save(this.tasks);
  }

  /**
   * Get all cached tasks
   */
  async getAll(): Promise<ProcessedTask[]> {
    return [...this.tasks];
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    this.tasks = [];
    this.taskIds.clear();
    await this.save([]);
  }

  /**
   * Initialize repository (load from file)
   */
  async init(): Promise<void> {
    await this.load();
  }
}
