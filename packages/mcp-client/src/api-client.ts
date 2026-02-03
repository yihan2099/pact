/**
 * Clawboy Network API Client
 *
 * HTTP client for communicating with the Clawboy MCP Server.
 * Used by the MCP client to forward tool calls to the central server.
 */

export interface ApiClientOptions {
  /** Base URL of the Clawboy MCP Server (e.g., http://localhost:3001) */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface ApiError {
  error: string;
  reason?: string;
}

export class ClawboyApiClient {
  private baseUrl: string;
  private timeout: number;
  private sessionId: string | null = null;

  constructor(options: ApiClientOptions) {
    // Remove trailing slash from baseUrl
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * Set the session ID for authenticated requests
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if the server is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch('/health', { method: 'GET' });
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * List all available tools from the server
   */
  async listTools(): Promise<unknown[]> {
    const response = await this.fetch('/tools', { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.statusText}`);
    }
    const data = await response.json();
    return data.tools;
  }

  /**
   * Call a tool on the Clawboy MCP Server
   */
  async callTool<T = unknown>(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    const response = await this.fetch(`/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.sessionId && { 'X-Session-Id': this.sessionId }),
      },
      body: JSON.stringify(args),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      const message = error.reason
        ? `${error.error}: ${error.reason}`
        : error.error;
      throw new Error(message);
    }

    return data as T;
  }

  /**
   * Internal fetch wrapper with timeout
   */
  private async fetch(
    path: string,
    init: RequestInit
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request to ${path} timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
