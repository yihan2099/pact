/**
 * A2A Protocol Types
 *
 * Type definitions for the Agent-to-Agent (A2A) Protocol.
 * Based on the A2A Protocol Specification v1.0
 * https://a2a-protocol.org/latest/specification/
 */

// ============================================================================
// Agent Card Types
// ============================================================================

/**
 * A2A Agent Card - describes agent capabilities for discovery
 */
export interface A2AAgentCard {
  /** Agent display name */
  name: string;
  /** Agent description */
  description: string;
  /** Base URL for the A2A endpoint */
  url: string;
  /** Agent version */
  version: string;
  /** A2A protocol version supported */
  protocolVersion: string;
  /** Agent provider information */
  provider?: A2AProvider;
  /** Authentication schemes supported */
  authentication?: A2AAuthentication;
  /** Agent capabilities */
  capabilities: A2ACapabilities;
  /** Available skills (mapped from MCP tools) */
  skills: A2ASkill[];
  /** ERC-8004 identity information */
  identity?: A2AIdentity;
}

/**
 * Agent provider information
 */
export interface A2AProvider {
  organization: string;
  url?: string;
}

/**
 * Authentication configuration
 */
export interface A2AAuthentication {
  schemes: A2AAuthScheme[];
}

/**
 * Authentication scheme
 */
export interface A2AAuthScheme {
  /** Scheme identifier */
  scheme: 'wallet-signature' | 'bearer' | 'none';
  /** Human-readable instructions for authentication */
  instructions?: string;
}

/**
 * Agent capabilities declaration
 */
export interface A2ACapabilities {
  /** Supports SSE streaming for task updates */
  streaming: boolean;
  /** Supports push notifications (webhooks) */
  pushNotifications: boolean;
  /** Maintains stateful task history */
  statefulness: boolean;
}

/**
 * A2A Skill definition (mapped from MCP tool)
 */
export interface A2ASkill {
  /** Unique skill identifier */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Skill description */
  description: string;
  /** JSON Schema for skill input */
  inputSchema: Record<string, unknown>;
  /** Access level required */
  accessLevel?: 'public' | 'authenticated' | 'registered';
  /** Skill category */
  category?: string;
}

/**
 * ERC-8004 identity information
 */
export interface A2AIdentity {
  erc8004: {
    /** Chain ID where contracts are deployed */
    chainId: number;
    /** ClawboyAgentAdapter contract address */
    agentAdapter: string;
    /** ERC-8004 IdentityRegistry contract address */
    identityRegistry: string;
    /** ERC-8004 ReputationRegistry contract address */
    reputationRegistry: string;
  };
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * A2A Task status
 */
export type A2ATaskStatus = 'pending' | 'working' | 'completed' | 'failed' | 'cancelled';

/**
 * A2A Task - represents a skill execution request
 */
export interface A2ATask {
  /** Unique task identifier */
  id: string;
  /** Current task status */
  status: A2ATaskStatus;
  /** Skill ID being executed */
  skillId: string;
  /** Input provided to the skill */
  input: Record<string, unknown>;
  /** Output from skill execution (when completed) */
  output?: A2ATaskOutput;
  /** Error information (when failed) */
  error?: A2ATaskError;
  /** Session ID that created this task */
  sessionId: string;
  /** Task creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Task output
 */
export interface A2ATaskOutput {
  /** Output type */
  type: 'result';
  /** Result data */
  data: unknown;
}

/**
 * Task error
 */
export interface A2ATaskError {
  /** Error code */
  code: number;
  /** Error message */
  message: string;
  /** Additional error data */
  data?: unknown;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role
 */
export type A2AMessageRole = 'user' | 'agent';

/**
 * Message part types
 */
export type A2AMessagePart = A2ATextPart | A2ADataPart;

/**
 * Text content part
 */
export interface A2ATextPart {
  type: 'text';
  text: string;
}

/**
 * Data content part
 */
export interface A2ADataPart {
  type: 'data';
  mimeType: string;
  data: string; // Base64 encoded
}

/**
 * A2A Message
 */
export interface A2AMessage {
  role: A2AMessageRole;
  parts: A2AMessagePart[];
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export interface A2AJsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: T;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface A2AJsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: T;
  error?: A2AJsonRpcError;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface A2AJsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// Method Parameters
// ============================================================================

/**
 * message/send parameters
 */
export interface MessageSendParams {
  skillId: string;
  input?: Record<string, unknown>;
}

/**
 * message/stream parameters
 */
export interface MessageStreamParams {
  skillId: string;
  input?: Record<string, unknown>;
}

/**
 * tasks/get parameters
 */
export interface TasksGetParams {
  taskId: string;
}

/**
 * tasks/list parameters
 */
export interface TasksListParams {
  limit?: number;
  offset?: number;
  status?: A2ATaskStatus;
}

/**
 * tasks/cancel parameters
 */
export interface TasksCancelParams {
  taskId: string;
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * A2A Protocol error codes
 */
export const A2A_ERROR_CODES = {
  // JSON-RPC standard errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // A2A specific errors
  TASK_NOT_FOUND: -32001,
  ACCESS_DENIED: -32002,
  SKILL_NOT_FOUND: -32003,
  TASK_CANCELLED: -32004,
  TASK_ALREADY_COMPLETED: -32005,
  SESSION_REQUIRED: -32006,
} as const;

/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): A2AJsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  };
}

/**
 * Create a JSON-RPC success response
 */
export function createSuccessResponse<T>(id: string | number, result: T): A2AJsonRpcResponse<T> {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

// ============================================================================
// SSE Event Types
// ============================================================================

/**
 * SSE event types for message/stream
 */
export type A2ASSEEventType =
  | 'task.created'
  | 'task.status'
  | 'task.completed'
  | 'task.failed'
  | 'done';

/**
 * SSE event data
 */
export interface A2ASSEEvent {
  event: A2ASSEEventType;
  data: A2ATask | { taskId: string; status: A2ATaskStatus };
}
