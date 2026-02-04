/**
 * message/stream Handler
 *
 * Executes a skill with SSE streaming for task updates.
 */

import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { MessageStreamParams, A2ATask, A2ASSEEventType } from '../types';
import { A2A_ERROR_CODES } from '../types';
import { createA2ATask, updateA2ATaskStatus } from '../task-store';
import { executeSkill, skillRequiresAuth } from '../skill-bridge';
import { skillExists } from '../agent-card';
import { getServerContext, getSessionIdFromContext } from '../a2a-auth';

/**
 * Send an SSE event
 */
function createSSEData(event: A2ASSEEventType, data: unknown): string {
  return JSON.stringify({ event, data });
}

/**
 * Handle message/stream JSON-RPC method
 * Executes a skill with SSE streaming
 */
export async function handleMessageStream(
  c: Context,
  id: string | number,
  params: MessageStreamParams
): Promise<Response> {
  const context = getServerContext(c);
  const sessionId = getSessionIdFromContext(c);

  // Validate params
  if (!params?.skillId) {
    return c.json(
      {
        jsonrpc: '2.0',
        id,
        error: {
          code: A2A_ERROR_CODES.INVALID_PARAMS,
          message: 'Missing required parameter: skillId',
        },
      },
      400
    );
  }

  const { skillId, input = {} } = params;

  // Check if skill exists
  if (!skillExists(skillId)) {
    return c.json(
      {
        jsonrpc: '2.0',
        id,
        error: {
          code: A2A_ERROR_CODES.SKILL_NOT_FOUND,
          message: `Skill not found: ${skillId}`,
        },
      },
      400
    );
  }

  // Check if authentication is required for this skill
  if (skillRequiresAuth(skillId) && !context.isAuthenticated) {
    return c.json(
      {
        jsonrpc: '2.0',
        id,
        error: {
          code: A2A_ERROR_CODES.SESSION_REQUIRED,
          message:
            'This skill requires authentication. Use wallet-signature auth flow to get a session.',
        },
      },
      401
    );
  }

  // For public skills without a session, we use a temporary session ID
  const effectiveSessionId = sessionId || `anonymous-${crypto.randomUUID()}`;

  // Return SSE stream
  return streamSSE(c, async (stream) => {
    // Create the task
    const task = await createA2ATask(skillId, input, effectiveSessionId);

    // Send task.created event
    await stream.writeSSE({
      event: 'task.created',
      data: createSSEData('task.created', task),
      id: `${task.id}-created`,
    });

    // Update status to working
    await updateA2ATaskStatus(task.id, 'working');

    // Send task.status event
    await stream.writeSSE({
      event: 'task.status',
      data: createSSEData('task.status', { taskId: task.id, status: 'working' }),
      id: `${task.id}-working`,
    });

    // Execute the skill
    const result = await executeSkill(skillId, input, context);

    // Update task with result
    let finalTask: A2ATask;
    if (result.success) {
      finalTask = (await updateA2ATaskStatus(task.id, 'completed', {
        type: 'result',
        data: result.data,
      }))!;

      // Send task.completed event
      await stream.writeSSE({
        event: 'task.completed',
        data: createSSEData('task.completed', finalTask),
        id: `${task.id}-completed`,
      });
    } else {
      finalTask = (await updateA2ATaskStatus(task.id, 'failed', undefined, result.error))!;

      // Send task.failed event
      await stream.writeSSE({
        event: 'task.failed',
        data: createSSEData('task.failed', finalTask),
        id: `${task.id}-failed`,
      });
    }

    // Send done event
    await stream.writeSSE({
      event: 'done',
      data: createSSEData('done', { taskId: task.id }),
      id: `${task.id}-done`,
    });
  });
}
