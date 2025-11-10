/**
 * JSON File Storage
 * Generic JSON file storage implementation
 */

import fs from 'fs';
import path from 'path';
import { FileReadError, FileWriteError, FileNotFoundError } from '../../shared/errors';

export interface IStorage<T> {
  read(): Promise<T>;
  write(data: T): Promise<void>;
  exists(): Promise<boolean>;
  delete(): Promise<void>;
}

export class JSONStorage<T> implements IStorage<T> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T
  ) {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Read data from JSON file
   */
  async read(): Promise<T> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return this.defaultValue;
      }

      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content) as T;
    } catch (error) {
      throw new FileReadError(this.filePath, error as Error);
    }
  }

  /**
   * Write data to JSON file
   */
  async write(data: T): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(this.filePath, content, 'utf8');
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Check if file exists
   */
  async exists(): Promise<boolean> {
    return fs.existsSync(this.filePath);
  }

  /**
   * Delete file
   */
  async delete(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (error) {
      throw new FileWriteError(this.filePath, error as Error);
    }
  }

  /**
   * Get file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}
