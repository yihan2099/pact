import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ClawboyApiClient } from '../api-client.js';

// Store original fetch
const originalFetch = globalThis.fetch;

describe('ClawboyApiClient', () => {
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('constructor', () => {
    test('should set baseUrl and strip trailing slash', () => {
      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001/',
      });

      expect(client).toBeDefined();
      // Verify trailing slash removal by calling a method that exposes the URL
      client.healthCheck();
      const calledUrl = (mockFetch.mock.calls[0] as unknown[])[0] as string;
      expect(calledUrl).toBe('http://localhost:3001/health');
    });

    test('should default timeout to 30000ms', () => {
      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      expect(client).toBeDefined();
    });

    test('should accept custom timeout', () => {
      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
        timeout: 5000,
      });

      expect(client).toBeDefined();
    });
  });

  describe('session management', () => {
    test('should start with null sessionId', () => {
      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      expect(client.getSessionId()).toBeNull();
    });

    test('should set and get sessionId', () => {
      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      client.setSessionId('session-123');
      expect(client.getSessionId()).toBe('session-123');
    });

    test('should clear sessionId when set to null', () => {
      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      client.setSessionId('session-123');
      client.setSessionId(null);
      expect(client.getSessionId()).toBeNull();
    });
  });

  describe('healthCheck', () => {
    test('should return true when server responds with status ok', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    test('should return false when server responds with non-ok status', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ status: 'error' }), { status: 200 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    test('should return false on network error', async () => {
      mockFetch.mockImplementation(() => Promise.reject(new Error('Network unreachable')));

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('listTools', () => {
    test('should GET /tools and return tools array', async () => {
      const toolsList = [{ name: 'list_tasks' }, { name: 'get_task' }];
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ tools: toolsList }), { status: 200 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      const result = await client.listTools();
      expect(result).toEqual(toolsList);

      const calledUrl = (mockFetch.mock.calls[0] as unknown[])[0] as string;
      expect(calledUrl).toBe('http://localhost:3001/tools');
    });

    test('should throw on non-200 response', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response('Server Error', {
            status: 500,
            statusText: 'Internal Server Error',
          })
        )
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      await expect(client.listTools()).rejects.toThrow(
        'Failed to list tools: Internal Server Error'
      );
    });
  });

  describe('callTool', () => {
    test('should POST to /tools/:name with args as body', async () => {
      const toolResponse = { tasks: [], total: 0 };
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(toolResponse), { status: 200 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      const result = await client.callTool('list_tasks', { status: 'open' });

      expect(result).toEqual(toolResponse);

      const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe('http://localhost:3001/tools/list_tasks');
      expect(calledInit.method).toBe('POST');
      expect(calledInit.body).toBe(JSON.stringify({ status: 'open' }));
    });

    test('should include X-Session-Id header when sessionId is set', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });
      client.setSessionId('my-session-id');

      await client.callTool('get_task', { taskId: '1' });

      const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = calledInit.headers as Record<string, string>;
      expect(headers['X-Session-Id']).toBe('my-session-id');
    });

    test('should not include X-Session-Id header when sessionId is null', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      await client.callTool('get_task', { taskId: '1' });

      const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = calledInit.headers as Record<string, string>;
      expect(headers['X-Session-Id']).toBeUndefined();
    });

    test('should throw with error message on non-200 response', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Not found', reason: 'Task does not exist' }), {
            status: 404,
          })
        )
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      await expect(client.callTool('get_task', { taskId: '999' })).rejects.toThrow(
        'Not found: Task does not exist'
      );
    });

    test('should throw error without reason when reason is absent', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      await expect(client.callTool('create_task', {})).rejects.toThrow('Unauthorized');
    });

    test('should default args to empty object', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ tools: [] }), { status: 200 }))
      );

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      await client.callTool('list_tasks');

      const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(calledInit.body).toBe(JSON.stringify({}));
    });
  });

  describe('timeout handling', () => {
    test('should throw timeout error when request exceeds timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      mockFetch.mockImplementation(() => Promise.reject(abortError));

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
        timeout: 100,
      });

      await expect(client.callTool('slow_tool', {})).rejects.toThrow(
        'Request to /tools/slow_tool timed out after 100ms'
      );
    });

    test('should re-throw non-abort errors as-is', async () => {
      mockFetch.mockImplementation(() => Promise.reject(new Error('DNS resolution failed')));

      const client = new ClawboyApiClient({
        baseUrl: 'http://localhost:3001',
      });

      await expect(client.callTool('any_tool', {})).rejects.toThrow('DNS resolution failed');
    });
  });
});
