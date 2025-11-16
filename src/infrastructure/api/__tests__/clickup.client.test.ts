/**
 * ClickUp API Client Tests
 * Tests for ClickUp API interactions
 */

import { ClickUpClient } from '../clickup.client';
import { ClickUpAPIError } from '../../../shared/errors';
import type { ClickUpTask, ClickUpComment } from '../../../types/clickup';

// Mock axios
jest.mock('axios');

describe('ClickUpClient', () => {
  let client: ClickUpClient;
  let mockGet: jest.Mock;
  let mockPost: jest.Mock;
  let mockPut: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create client
    client = new ClickUpClient({
      apiKey: 'test-api-key',
    });

    // Get mock methods from the client's instance
    mockGet = jest.fn();
    mockPost = jest.fn();
    mockPut = jest.fn();

    // Replace the methods on the client
    (client as any).get = mockGet;
    (client as any).post = mockPost;
    (client as any).put = mockPut;
  });

  describe('getTask', () => {
    it('should fetch task by ID successfully', async () => {
      const mockTask: Partial<ClickUpTask> = {
        id: 'task-123',
        name: 'Test Task',
        description: 'Task description',
        status: {
          status: 'in progress',
        },
      };

      mockGet.mockResolvedValue(mockTask);

      const result = await client.getTask('task-123');

      expect(mockGet).toHaveBeenCalledWith('/task/task-123');
      expect(result).toEqual(mockTask);
    });

    it('should throw ClickUpAPIError on failure', async () => {
      const error = new Error('Network error');
      mockGet.mockRejectedValue(error);

      await expect(client.getTask('task-123')).rejects.toThrow(ClickUpAPIError);
      await expect(client.getTask('task-123')).rejects.toThrow(
        'Failed to fetch task task-123'
      );
    });
  });

  describe('getTasksInList', () => {
    it('should fetch tasks in a list', async () => {
      const mockTasks: Partial<ClickUpTask>[] = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' },
      ];

      mockGet.mockResolvedValue({ tasks: mockTasks });

      const result = await client.getTasksInList('list-123');

      expect(mockGet).toHaveBeenCalledWith('/list/list-123/task');
      expect(result).toEqual(mockTasks);
    });

    it('should throw ClickUpAPIError on failure', async () => {
      const error = new Error('API error');
      mockGet.mockRejectedValue(error);

      await expect(client.getTasksInList('list-123')).rejects.toThrow(ClickUpAPIError);
      await expect(client.getTasksInList('list-123')).rejects.toThrow(
        'Failed to fetch tasks in list list-123'
      );
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      mockPut.mockResolvedValue({});

      await client.updateTaskStatus('task-123', 'in progress');

      expect(mockPut).toHaveBeenCalledWith('/task/task-123', {
        status: 'in progress',
      });
    });

    it('should throw ClickUpAPIError on failure', async () => {
      const error = new Error('Update failed');
      mockPut.mockRejectedValue(error);

      await expect(client.updateTaskStatus('task-123', 'in progress')).rejects.toThrow(
        ClickUpAPIError
      );
      await expect(client.updateTaskStatus('task-123', 'in progress')).rejects.toThrow(
        'Failed to update status for task task-123'
      );
    });
  });

  describe('addComment', () => {
    it('should add comment to task successfully', async () => {
      const mockCommentData = {
        id: 'comment-123',
        comment_text: 'Test comment',
        user: { id: 123, username: 'testuser' },
      };

      mockPost.mockResolvedValue(mockCommentData);

      const result = await client.addComment('task-123', 'Test comment');

      expect(mockPost).toHaveBeenCalledWith('/task/task-123/comment', {
        comment_text: 'Test comment',
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCommentData);
    });

    it('should return error response on failure', async () => {
      const error = new Error('Comment failed');
      mockPost.mockRejectedValue(error);

      const result = await client.addComment('task-123', 'Test comment');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comment failed');
    });
  });

  describe('getTaskComments', () => {
    it('should fetch task comments successfully', async () => {
      const mockComments: Partial<ClickUpComment>[] = [
        {
          id: 'comment-1',
          comment_text: 'Comment 1',
          user: { id: 123, username: 'user1' },
        },
        {
          id: 'comment-2',
          comment_text: 'Comment 2',
          user: { id: 456, username: 'user2' },
        },
      ];

      mockGet.mockResolvedValue({ comments: mockComments });

      const result = await client.getTaskComments('task-123');

      expect(mockGet).toHaveBeenCalledWith('/task/task-123/comment');
      expect(result).toEqual(mockComments);
    });

    it('should return empty array when no comments', async () => {
      mockGet.mockResolvedValue({});

      const result = await client.getTaskComments('task-123');

      expect(result).toEqual([]);
    });

    it('should throw ClickUpAPIError on failure', async () => {
      const error = new Error('Fetch failed');
      mockGet.mockRejectedValue(error);

      await expect(client.getTaskComments('task-123')).rejects.toThrow(ClickUpAPIError);
      await expect(client.getTaskComments('task-123')).rejects.toThrow(
        'Failed to fetch comments for task task-123'
      );
    });
  });

  describe('getAssignedTasks', () => {
    it('should fetch assigned tasks successfully', async () => {
      const mockTasks: Partial<ClickUpTask>[] = [
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' },
      ];

      mockGet.mockResolvedValue({ tasks: mockTasks });

      const result = await client.getAssignedTasks(123, 'workspace-456');

      expect(mockGet).toHaveBeenCalledWith('/team/workspace-456/task', {
        params: {
          assignees: [123],
        },
      });
      expect(result).toEqual(mockTasks);
    });

    it('should return empty array when no tasks', async () => {
      mockGet.mockResolvedValue({});

      const result = await client.getAssignedTasks(123, 'workspace-456');

      expect(result).toEqual([]);
    });

    it('should throw ClickUpAPIError on failure', async () => {
      const error = new Error('API error');
      mockGet.mockRejectedValue(error);

      await expect(client.getAssignedTasks(123, 'workspace-456')).rejects.toThrow(
        ClickUpAPIError
      );
    });
  });

  describe('Client Configuration', () => {
    it('should set correct base URL', () => {
      const client = new ClickUpClient({
        apiKey: 'test-api-key',
      });

      // The base URL should be ClickUp API v2
      expect((client as any).baseURL || (client as any).config?.baseURL).toContain(
        'api.clickup.com'
      );
    });

    it('should include API key in headers', () => {
      const client = new ClickUpClient({
        apiKey: 'test-api-key-123',
      });

      const headers = (client as any).headers || (client as any).config?.headers;
      expect(headers?.Authorization).toBe('test-api-key-123');
      expect(headers?.['Content-Type']).toBe('application/json');
    });

    it('should accept custom timeout', () => {
      const client = new ClickUpClient({
        apiKey: 'test-api-key',
        timeout: 5000,
      });

      const timeout = (client as any).timeout || (client as any).config?.timeout;
      expect(timeout).toBe(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNREFUSED';

      mockGet.mockRejectedValue(networkError);

      await expect(client.getTask('task-123')).rejects.toThrow(ClickUpAPIError);
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).response = { status: 429 };

      mockGet.mockRejectedValue(rateLimitError);

      await expect(client.getTask('task-123')).rejects.toThrow(ClickUpAPIError);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ETIMEDOUT';

      mockGet.mockRejectedValue(timeoutError);

      await expect(client.getTask('task-123')).rejects.toThrow(ClickUpAPIError);
    });

    it('should handle 404 errors', async () => {
      const notFoundError = new Error('Not found');
      (notFoundError as any).response = { status: 404 };

      mockGet.mockRejectedValue(notFoundError);

      await expect(client.getTask('task-123')).rejects.toThrow(ClickUpAPIError);
    });

    it('should handle 500 errors', async () => {
      const serverError = new Error('Internal server error');
      (serverError as any).response = { status: 500 };

      mockGet.mockRejectedValue(serverError);

      await expect(client.getTask('task-123')).rejects.toThrow(ClickUpAPIError);
    });
  });
});
