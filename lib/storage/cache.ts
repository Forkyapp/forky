import fs from 'fs';
import config from '../config';
import type { TaskData, ProcessedTask } from '../types';

let processedTasksData: ProcessedTask[] = [];
let processedTaskIds = new Set<string>();

const FILES = {
  cache: config.files.cacheFile
};

export const cache = {
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
