/**
 * tasks/get Handler
 *
 * Get a task by ID. Validates session ownership.
 */

import type { Context } from 'hono';
import type { A2AJsonRpcResponse, TasksGetParams } from '../types';
import { A2A_ERROR_CODES, createErrorResponse, createSuccessResponse } from '../types';
import { getA2ATask } from '../task-store';
import { getSessionIdFromContext } from '../a2a-auth';

/**
 * Handle tasks/get JSON-RPC method
 */
export async function handleTasksGet(
  c: Context,
  id: string | number,
  params: TasksGetParams
): Promise<A2AJsonRpcResponse> {
  const sessionId = getSessionIdFromContext(c);

  // Validate params
  if (!params?.taskId) {
    return createErrorResponse(
      id,
      A2A_ERROR_CODES.INVALID_PARAMS,
      'Missing required parameter: taskId'
    );
  }

  const { taskId } = params;

  // Get the task
  const task = await getA2ATask(taskId);

  if (!task) {
    return createErrorResponse(id, A2A_ERROR_CODES.TASK_NOT_FOUND, `Task not found: ${taskId}`);
  }

  // SECURITY: Require exact session match for all tasks (including anonymous ones).
  // Anonymous callers already receive results inline from message/send,
  // so tasks/get does not need an exemption for anonymous tasks.
  if (task.sessionId !== sessionId) {
    return createErrorResponse(
      id,
      A2A_ERROR_CODES.ACCESS_DENIED,
      'Access denied: task belongs to a different session'
    );
  }

  return createSuccessResponse(id, task);
}
