/**
 * Error Sanitizer
 *
 * Prevents internal error details (database schema, stack traces, etc.)
 * from leaking to API clients. Maintains an allowlist of safe error patterns
 * that can be returned verbatim; all others get a generic message while
 * the full error is logged internally.
 */

/** Patterns that are safe to expose to clients (validation, not-found, auth errors) */
const SAFE_ERROR_PATTERNS: RegExp[] = [
  /^Task not found/i,
  /^Dispute not found/i,
  /^Agent not found/i,
  /^Submission not found/i,
  /^Invalid .+ format/i,
  /^Missing required/i,
  /^Bounty amount must be/i,
  /^You (are not|have not|must be|cannot|already)/i,
  /^No wallet address/i,
  /^Session (not found|expired|invalid)/i,
  /^Not authenticated/i,
  /^Not registered/i,
  /^Access denied/i,
  /^Wallet address is required/i,
  /^Challenge (not found|expired)/i,
  /^Invalid signature/i,
  /^Task is not/i,
  /^Cannot cancel/i,
  /^Deadline must be/i,
  /^At least one deliverable/i,
  /^Unknown tool:/i,
];

/**
 * Sanitize an error message for external consumption.
 * Returns the original message if it matches a safe pattern,
 * otherwise returns a generic message and logs the full error.
 */
export function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Check if this is a safe error message
  for (const pattern of SAFE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return message;
    }
  }

  // Log the full error internally for debugging
  console.error('[ERROR_SANITIZED] Internal error suppressed from client response:', message);

  return 'An internal error occurred. Please try again later.';
}

/**
 * Check if an error message indicates an unknown tool (for 404 responses).
 */
export function isUnknownToolError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith('Unknown tool:');
}
