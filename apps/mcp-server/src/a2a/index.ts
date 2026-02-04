/**
 * A2A Protocol Module
 *
 * Agent-to-Agent (A2A) Protocol implementation for Clawboy.
 * Enables cross-platform agent communication via standard A2A protocol.
 */

// Router
export { a2aRouter } from './router';

// Types
export type {
  A2AAgentCard,
  A2AProvider,
  A2AAuthentication,
  A2AAuthScheme,
  A2ACapabilities,
  A2ASkill,
  A2AIdentity,
  A2ATask,
  A2ATaskStatus,
  A2ATaskOutput,
  A2ATaskError,
  A2AMessage,
  A2AMessageRole,
  A2AMessagePart,
  A2ATextPart,
  A2ADataPart,
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
  A2AJsonRpcError,
  MessageSendParams,
  MessageStreamParams,
  TasksGetParams,
  TasksListParams,
  TasksCancelParams,
  A2ASSEEventType,
  A2ASSEEvent,
} from './types';

export { A2A_ERROR_CODES, createErrorResponse, createSuccessResponse } from './types';

// Agent Card
export { generateAgentCard, getSkillById, skillExists } from './agent-card';

// Task Store
export {
  createA2ATask,
  getA2ATask,
  updateA2ATaskStatus,
  listA2ATasksBySession,
  cancelA2ATask,
  getA2ATaskStats,
} from './task-store';

// Skill Bridge
export {
  executeSkill,
  getSkillMetadata,
  skillRequiresAuth,
  skillRequiresRegistration,
} from './skill-bridge';
export type { SkillExecutionResult } from './skill-bridge';

// Auth Middleware
export {
  a2aAuthMiddleware,
  extractSessionId,
  buildContext,
  getServerContext,
  getSessionIdFromContext,
  requireAuth,
} from './a2a-auth';
export type { A2AHonoContext } from './a2a-auth';

// Handlers
export {
  handleMessageSend,
  handleMessageStream,
  handleTasksGet,
  handleTasksList,
  handleTasksCancel,
} from './handlers';
