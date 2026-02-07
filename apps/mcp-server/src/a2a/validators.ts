/**
 * A2A JSON-RPC Parameter Validators
 *
 * Zod schemas for runtime validation of A2A method parameters.
 * Prevents malformed params from causing crashes or unexpected behavior.
 */

import { z } from 'zod';

/**
 * message/send params schema
 */
export const messageSendParamsSchema = z
  .object({
    skillId: z.string().min(1, 'skillId must be a non-empty string'),
    input: z.record(z.unknown()).optional().default({}),
  })
  .strict();

/**
 * message/stream params schema
 */
export const messageStreamParamsSchema = z
  .object({
    skillId: z.string().min(1, 'skillId must be a non-empty string'),
    input: z.record(z.unknown()).optional().default({}),
  })
  .strict();

/**
 * tasks/get params schema
 */
export const tasksGetParamsSchema = z
  .object({
    taskId: z.string().uuid('taskId must be a valid UUID'),
  })
  .strict();

/**
 * tasks/list params schema
 */
export const tasksListParamsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    status: z.enum(['pending', 'working', 'completed', 'failed', 'cancelled']).optional(),
  })
  .strict()
  .optional()
  .default({});

/**
 * tasks/cancel params schema
 */
export const tasksCancelParamsSchema = z
  .object({
    taskId: z.string().uuid('taskId must be a valid UUID'),
  })
  .strict();

/**
 * Validate params and return a formatted error message if invalid
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: `Invalid params: ${issues}` };
}
