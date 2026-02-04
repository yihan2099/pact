/**
 * tasks/get Handler
 *
 * Get a task by ID. Validates session ownership.
 */

import type { Context } from 'hono';
import type { A2AJsonRpcResponse, TasksGetParams } from '../types';
import { A2A_ERROR_CODES, createErrorResponse, createSuccessResponse } from '../types';
import { getA2ATask } from '../task-store';
import { getServerContext, getSessionIdFromContext } from '../a2a-auth';

/**
 * Handle tasks/get JSON-RPC method
 */
export async function handleTasksGet(
  c: Context,
  id: string | number,
  params: TasksGetParams
): Promise<A2AJsonRpcResponse> {
  const context = getServerContext(c);
  const sessionId = getSessionIdFromContext(c);

  // Validate params
  if (!params?.taskId) {
    return createErrorResponse(id, A2A_ERROR_CODES.INVALID_PARAMS, 'Missing required parameter: taskId');
  }

  const { taskId } = params;

  // Get the task
  const task = await getA2ATask(taskId);

  if (!task) {
    return createErrorResponse(id, A2A_ERROR_CODES.TASK_NOT_FOUND, `Task not found: ${taskId}`);
  }

  // Validate session ownership
  // Anonymous tasks (with `anonymous-` prefix) can be accessed without auth
  // Otherwise, the session must match
  const isAnonymousTask = task.sessionId.startsWith('anonymous-');
  if (!isAnonymousTask && task.sessionId !== sessionId) {
    // If authenticated but different session, still allow access (same user may have multiple sessions)
    // For now, we require exact session match for security
    return createErrorResponse(id, A2A_ERROR_CODES.ACCESS_DENIED, 'Access denied: task belongs to a different session');
  }

  return createSuccessResponse(id, task);
}
