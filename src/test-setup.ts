/**
 * Test Setup and Utilities
 * Common test helpers and mock factories
 */

import fs from 'fs';
import path from 'path';

/**
 * Create a temporary test directory
 */
export function createTempDir(prefix: string): string {
  const tmpDir = path.join(__dirname, '..', 'tmp', `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

/**
 * Clean up temporary test directory
 */
export function cleanupTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Create a temporary test file
 */
export function createTempFile(dirPath: string, filename: string, content: string): string {
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Mock ClickUp task data factory
 */
export function createMockClickUpTask(overrides: Record<string, any> = {}) {
  return {
    id: 'test-task-123',
    name: 'Test Task',
    title: 'Test Task',
    description: 'Test task description',
    text_content: 'Test task content',
    url: 'https://app.clickup.com/t/test-task-123',
    status: {
      status: 'open',
      color: '#d3d3d3',
      type: 'open',
    },
    date_created: '1234567890000',
    date_updated: '1234567890000',
    ...overrides,
  };
}

/**
 * Mock GitHub issue data factory
 */
export function createMockGitHubIssue(overrides: Record<string, any> = {}) {
  return {
    number: 1,
    title: 'Test Issue',
    body: 'Test issue body',
    state: 'open',
    html_url: 'https://github.com/test/repo/issues/1',
    user: {
      login: 'testuser',
    },
    labels: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Mock config data factory
 */
export function createMockConfig(overrides: Record<string, any> = {}) {
  return {
    clickup: {
      apiKey: 'test-api-key',
      listId: 'test-list-id',
      teamId: 'test-team-id',
    },
    github: {
      token: 'test-github-token',
      owner: 'test-owner',
      repo: 'test-repo',
    },
    polling: {
      intervalMs: 60000,
      enabled: true,
    },
    ...overrides,
  };
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock logger that captures log messages
 */
export class MockLogger {
  public logs: Array<{ level: string; message: string; meta?: unknown }> = [];

  info(message: string, meta?: unknown): void {
    this.logs.push({ level: 'info', message, meta });
  }

  error(message: string, meta?: unknown): void {
    this.logs.push({ level: 'error', message, meta });
  }

  warn(message: string, meta?: unknown): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  debug(message: string, meta?: unknown): void {
    this.logs.push({ level: 'debug', message, meta });
  }

  clear(): void {
    this.logs = [];
  }

  hasLog(level: string, message: string): boolean {
    return this.logs.some((log) => log.level === level && log.message.includes(message));
  }
}

/**
 * Suppress console output during tests
 */
export function suppressConsole() {
  const originalConsole = { ...console };

  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });

  afterAll(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });
}
