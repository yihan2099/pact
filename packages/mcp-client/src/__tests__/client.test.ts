import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock @modelcontextprotocol/sdk before importing the module under test
const mockConnect = mock(() => Promise.resolve());
const mockClose = mock(() => Promise.resolve());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCallTool = mock(() => Promise.resolve({ content: [] } as any));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockListTools = mock(() => Promise.resolve({ tools: [] } as any));

mock.module('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class MockClient {
    connect = mockConnect;
    close = mockClose;
    callTool = mockCallTool;
    listTools = mockListTools;
  },
}));

mock.module('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class MockStdioTransport {
    constructor(_opts: unknown) {}
  },
}));

import { ClawboyClient, createClawboyClient } from '../client.js';

describe('ClawboyClient', () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockClose.mockClear();
    mockCallTool.mockClear();
    mockListTools.mockClear();
  });

  describe('constructor', () => {
    test('should use provided config values', () => {
      const client = new ClawboyClient({
        privateKey: '0xabc123',
        serverUrl: 'https://custom-server.com',
        rpcUrl: 'https://custom-rpc.com',
      });

      expect(client).toBeDefined();
      expect(client.getClient()).toBeDefined();
    });

    test('should apply default serverUrl and rpcUrl when not provided', () => {
      const client = new ClawboyClient({
        privateKey: '0xabc123',
      });

      expect(client).toBeDefined();
      expect(client.getClient()).toBeDefined();
    });
  });

  describe('connect', () => {
    test('should create a transport and connect the underlying client', async () => {
      const client = new ClawboyClient({ privateKey: '0xabc123' });

      await client.connect();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    test('should propagate connection errors', async () => {
      mockConnect.mockImplementationOnce(() => Promise.reject(new Error('Connection failed')));

      const client = new ClawboyClient({ privateKey: '0xabc123' });

      await expect(client.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    test('should call close on the underlying client', async () => {
      const client = new ClawboyClient({ privateKey: '0xabc123' });

      await client.disconnect();

      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('callTool', () => {
    test('should forward tool name and arguments to the underlying client', async () => {
      const expectedResult = { content: [{ type: 'text', text: 'hello' }] };
      mockCallTool.mockImplementationOnce(() => Promise.resolve(expectedResult));

      const client = new ClawboyClient({ privateKey: '0xabc123' });
      const result = await client.callTool('list_tasks', { status: 'open' });

      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'list_tasks',
        arguments: { status: 'open' },
      });
      expect(result).toEqual(expectedResult);
    });

    test('should propagate tool call errors', async () => {
      mockCallTool.mockImplementationOnce(() => Promise.reject(new Error('Tool not found')));

      const client = new ClawboyClient({ privateKey: '0xabc123' });

      await expect(client.callTool('nonexistent_tool', {})).rejects.toThrow('Tool not found');
    });
  });

  describe('listTools', () => {
    test('should return available tools from the underlying client', async () => {
      const expectedTools = {
        tools: [{ name: 'list_tasks' }, { name: 'get_task' }],
      };
      mockListTools.mockImplementationOnce(() => Promise.resolve(expectedTools));

      const client = new ClawboyClient({ privateKey: '0xabc123' });
      const result = await client.listTools();

      expect(mockListTools).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(result).toEqual(expectedTools as any);
    });
  });

  describe('getClient', () => {
    test('should return the underlying MCP Client instance', () => {
      const client = new ClawboyClient({ privateKey: '0xabc123' });
      const underlying = client.getClient();

      expect(underlying).toBeDefined();
      expect(typeof underlying.connect).toBe('function');
      expect(typeof underlying.close).toBe('function');
    });
  });
});

describe('createClawboyClient', () => {
  test('should throw if CLAWBOY_WALLET_PRIVATE_KEY is not set', () => {
    const original = process.env.CLAWBOY_WALLET_PRIVATE_KEY;
    delete process.env.CLAWBOY_WALLET_PRIVATE_KEY;

    try {
      expect(() => createClawboyClient()).toThrow(
        'CLAWBOY_WALLET_PRIVATE_KEY environment variable is required'
      );
    } finally {
      if (original !== undefined) {
        process.env.CLAWBOY_WALLET_PRIVATE_KEY = original;
      }
    }
  });

  test('should create a client when env var is set', () => {
    const original = process.env.CLAWBOY_WALLET_PRIVATE_KEY;
    process.env.CLAWBOY_WALLET_PRIVATE_KEY = '0xdeadbeef';

    try {
      const client = createClawboyClient();
      expect(client).toBeInstanceOf(ClawboyClient);
    } finally {
      if (original !== undefined) {
        process.env.CLAWBOY_WALLET_PRIVATE_KEY = original;
      } else {
        delete process.env.CLAWBOY_WALLET_PRIVATE_KEY;
      }
    }
  });
});
