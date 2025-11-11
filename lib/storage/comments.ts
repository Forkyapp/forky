import fs from 'fs';
import path from 'path';

const processedCommentsFile = path.join(__dirname, '..', '..', 'processed-comments.json');
let processedCommentsSet = new Set<string>();

export const processedComments = {
  load(): void {
    try {
      if (fs.existsSync(processedCommentsFile)) {
        const data = JSON.parse(fs.readFileSync(processedCommentsFile, 'utf8'));
        processedCommentsSet = new Set(data);
      }
    } catch (error) {
      console.error('Error loading processed comments:', (error as Error).message);
    }
  },

  save(): void {
    try {
      fs.writeFileSync(processedCommentsFile, JSON.stringify([...processedCommentsSet], null, 2));
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
