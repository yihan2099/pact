/**
 * API Error Utilities
 *
 * Standardized error types and formatters for consistent error responses
 * across MCP (stdio), HTTP REST, and A2A layers.
 */

import { sanitizeErrorMessage, isUnknownToolError } from './error-sanitizer';

/** Standardized error codes used across all API layers */
export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  ACCESS_DENIED: 'ACCESS_DENIED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  NOT_REGISTERED: 'NOT_REGISTERED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Structured API error with machine-readable code and HTTP status.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly httpStatus: number = 500,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Infer an error code from an error message.
 * Used when errors are thrown as plain Error instances without a code.
 */
function inferErrorCode(message: string): ErrorCode {
  if (isUnknownToolError({ message })) return ERROR_CODES.UNKNOWN_TOOL;
  if (/^Access denied/i.test(message)) return ERROR_CODES.ACCESS_DENIED;
  if (/^Not authenticated/i.test(message)) return ERROR_CODES.NOT_AUTHENTICATED;
  if (/^Not registered/i.test(message)) return ERROR_CODES.NOT_REGISTERED;
  if (/not found/i.test(message)) return ERROR_CODES.NOT_FOUND;
  if (/^Invalid |^Missing required|^Bounty amount|^Deadline must|^At least one/i.test(message))
    return ERROR_CODES.VALIDATION_ERROR;
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Format an error for MCP (stdio) responses.
 * Sanitizes the message to prevent internal details from leaking.
 */
export function toMcpError(error: unknown): { error: string; code: string } {
  if (error instanceof ApiError) {
    return { error: sanitizeErrorMessage(error), code: error.code };
  }

  const sanitized = sanitizeErrorMessage(error);
  const rawMessage = error instanceof Error ? error.message : String(error);
  const code = inferErrorCode(rawMessage);
  return { error: sanitized, code };
}

/**
 * Format an error for HTTP REST responses.
 * Sanitizes the message and includes a machine-readable code.
 */
export function toHttpError(error: unknown): { error: string; code: string } {
  if (error instanceof ApiError) {
    return { error: sanitizeErrorMessage(error), code: error.code };
  }

  const sanitized = sanitizeErrorMessage(error);
  const rawMessage = error instanceof Error ? error.message : String(error);
  const code = inferErrorCode(rawMessage);
  return { error: sanitized, code };
}
