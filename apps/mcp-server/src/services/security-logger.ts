/**
 * Security Event Logger
 *
 * Logs security-relevant events for monitoring and incident response.
 * In production, these should be sent to a centralized logging system (e.g., Datadog, Splunk).
 */

export type SecurityEventType =
  | 'auth_challenge_requested'
  | 'auth_challenge_verified'
  | 'auth_challenge_failed'
  | 'auth_session_created'
  | 'auth_session_expired'
  | 'rate_limit_exceeded'
  | 'access_denied'
  | 'invalid_input'
  | 'suspicious_activity';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  ip?: string;
  walletAddress?: string;
  sessionId?: string;
  toolName?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a security event
 * In production, send to centralized logging system
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const logEntry = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    service: 'porter-mcp-server',
  };

  // Use structured logging format
  console.log(JSON.stringify({
    level: getLogLevel(event.type),
    message: `[SECURITY] ${event.type}`,
    ...logEntry,
  }));
}

/**
 * Get log level based on event type
 */
function getLogLevel(eventType: SecurityEventType): 'info' | 'warn' | 'error' {
  switch (eventType) {
    case 'auth_challenge_requested':
    case 'auth_challenge_verified':
    case 'auth_session_created':
      return 'info';

    case 'auth_challenge_failed':
    case 'auth_session_expired':
    case 'rate_limit_exceeded':
    case 'access_denied':
      return 'warn';

    case 'invalid_input':
    case 'suspicious_activity':
      return 'error';

    default:
      return 'info';
  }
}

/**
 * Log authentication attempt
 */
export function logAuthAttempt(
  success: boolean,
  ip: string,
  walletAddress: string,
  reason?: string
): void {
  logSecurityEvent({
    type: success ? 'auth_challenge_verified' : 'auth_challenge_failed',
    timestamp: new Date().toISOString(),
    ip,
    walletAddress,
    reason,
  });
}

/**
 * Log rate limit violation
 */
export function logRateLimitExceeded(
  ip: string,
  toolName: string,
  sessionId?: string
): void {
  logSecurityEvent({
    type: 'rate_limit_exceeded',
    timestamp: new Date().toISOString(),
    ip,
    toolName,
    sessionId,
  });
}

/**
 * Log access denial
 */
export function logAccessDenied(
  ip: string,
  toolName: string,
  reason: string,
  sessionId?: string
): void {
  logSecurityEvent({
    type: 'access_denied',
    timestamp: new Date().toISOString(),
    ip,
    toolName,
    reason,
    sessionId,
  });
}

/**
 * Log suspicious activity
 */
export function logSuspiciousActivity(
  ip: string,
  description: string,
  metadata?: Record<string, unknown>
): void {
  logSecurityEvent({
    type: 'suspicious_activity',
    timestamp: new Date().toISOString(),
    ip,
    reason: description,
    metadata,
  });
}
