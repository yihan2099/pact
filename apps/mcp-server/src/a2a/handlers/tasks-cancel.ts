/**
 * tasks/cancel Handler
 *
 * Cancel a pending or working task.
 */

import type { Context } from 'hono';
import type { A2AJsonRpcResponse, TasksCancelParams } from '../types';
import { A2A_ERROR_CODES, createErrorResponse, createSuccessResponse } from '../types';
import { getA2ATask, cancelA2ATask } from '../task-store';
import { getServerContext, getSessionIdFromContext } from '../a2a-auth';

/**
 * Handle tasks/cancel JSON-RPC method
 */
export async function handleTasksCancel(
  c: Context,
  id: string | number,
  params: TasksCancelParams
): Promise<A2AJsonRpcResponse> {
  const context = getServerContext(c);
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

  // Require authentication
  if (!context.isAuthenticated || !sessionId) {
    return createErrorResponse(
      id,
      A2A_ERROR_CODES.SESSION_REQUIRED,
      'Authentication required to cancel tasks'
    );
  }

  // Get the task first to check ownership
  const task = await getA2ATask(taskId);

  if (!task) {
    return createErrorResponse(id, A2A_ERROR_CODES.TASK_NOT_FOUND, `Task not found: ${taskId}`);
  }

  // Check ownership
  if (task.sessionId !== sessionId) {
    return createErrorResponse(
      id,
      A2A_ERROR_CODES.ACCESS_DENIED,
      'Access denied: task belongs to a different session'
    );
  }

  // Check if task can be cancelled
  if (task.status === 'completed') {
    return createErrorResponse(
      id,
      A2A_ERROR_CODES.TASK_ALREADY_COMPLETED,
      'Task is already completed'
    );
  }

  if (task.status === 'failed') {
    return createErrorResponse(
      id,
      A2A_ERROR_CODES.TASK_ALREADY_COMPLETED,
      'Task has already failed'
    );
  }

  if (task.status === 'cancelled') {
    return createErrorResponse(id, A2A_ERROR_CODES.TASK_CANCELLED, 'Task is already cancelled');
  }

  // Cancel the task
  const cancelledTask = await cancelA2ATask(taskId, sessionId);

  if (!cancelledTask) {
    return createErrorResponse(id, A2A_ERROR_CODES.INTERNAL_ERROR, 'Failed to cancel task');
  }

  return createSuccessResponse(id, cancelledTask);
}
