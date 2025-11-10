/**
 * JSON Storage Tests
 */

import fs from 'fs';
import { JSONStorage } from '../json-storage';
import { StorageError } from '../../../shared/errors';
import { createTempDir, cleanupTempDir } from '../../../test-setup';

describe('JSONStorage', () => {
  let tempDir: string;
  let storage: JSONStorage<any>;
  let filePath: string;

  beforeEach(() => {
    tempDir = createTempDir('storage-test');
    filePath = `${tempDir}/data.json`;
    storage = new JSONStorage(filePath, null);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('read', () => {
    it('should return null when file does not exist', async () => {
      const data = await storage.read();
      expect(data).toBeNull();
    });

    it('should read data from file', async () => {
      const testData = { key: 'value', number: 42 };
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const data = await storage.read();
      expect(data).toEqual(testData);
    });

    it('should throw StorageError on invalid JSON', async () => {
      fs.writeFileSync(filePath, 'invalid json');

      await expect(storage.read()).rejects.toThrow(StorageError);
    });
  });

  describe('write', () => {
    it('should write data to file', async () => {
      const testData = { key: 'value', number: 42 };
      await storage.write(testData);

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(fileContent);
      expect(parsed).toEqual(testData);
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = `${tempDir}/nested/dir/data.json`;
      const nestedStorage = new JSONStorage<any>(nestedPath, null);

      await nestedStorage.write({ test: true });

      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('should overwrite existing data', async () => {
      await storage.write({ old: 'data' });
      await storage.write({ new: 'data' });

      const data = await storage.read();
      expect(data).toEqual({ new: 'data' });
    });

    it('should format JSON with indentation', async () => {
      await storage.write({ key: 'value' });

      const fileContent = fs.readFileSync(filePath, 'utf8');
      expect(fileContent).toContain('\n');
      expect(fileContent).toContain('  ');
    });
  });

  describe('exists', () => {
    it('should return false when file does not exist', async () => {
      const exists = await storage.exists();
      expect(exists).toBe(false);
    });

    it('should return true when file exists', async () => {
      await storage.write({ test: true });

      const exists = await storage.exists();
      expect(exists).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete file', async () => {
      await storage.write({ test: true });
      expect(fs.existsSync(filePath)).toBe(true);

      await storage.delete();

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw error when file does not exist', async () => {
      await expect(storage.delete()).resolves.not.toThrow();
    });
  });


  describe('generic types', () => {
    interface TestData {
      id: string;
      name: string;
      count: number;
    }

    it('should work with typed data', async () => {
      const typedStorage = new JSONStorage<TestData>(filePath, {} as TestData);
      const testData: TestData = {
        id: '123',
        name: 'Test',
        count: 42,
      };

      await typedStorage.write(testData);
      const data = await typedStorage.read();

      expect(data).toEqual(testData);
    });

    it('should work with arrays', async () => {
      const arrayStorage = new JSONStorage<TestData[]>(filePath, []);
      const testData: TestData[] = [
        { id: '1', name: 'First', count: 1 },
        { id: '2', name: 'Second', count: 2 },
      ];

      await arrayStorage.write(testData);
      const data = await arrayStorage.read();

      expect(data).toEqual(testData);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple writes', async () => {
      const promises = [
        storage.write({ operation: 1 }),
        storage.write({ operation: 2 }),
        storage.write({ operation: 3 }),
      ];

      await Promise.all(promises);

      const data = await storage.read();
      expect(data).toBeDefined();
      expect(data.operation).toBeGreaterThanOrEqual(1);
      expect(data.operation).toBeLessThanOrEqual(3);
    });
  });
});
