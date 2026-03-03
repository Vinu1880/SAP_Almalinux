// lib/securityLogger.ts - Structured security event logging
// All security events are logged with a [SECURITY] prefix for easy filtering
// in log aggregation tools (Docker logs, journalctl, etc.)

export type SecurityEventType =
  | 'AUTH_FAILURE'
  | 'AUTH_SUCCESS'
  | 'RATE_LIMIT_HIT'
  | 'CORS_BLOCKED'
  | 'VALIDATION_FAILURE'
  | 'PATH_TRAVERSAL_ATTEMPT'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'CRON_AUTH_FAILURE'
  | 'AUDIT_LOGS_CLEANUP';

interface SecurityEvent {
  type: SecurityEventType;
  ip?: string;
  userEmail?: string;
  path?: string;
  details?: string;
}

export function logSecurityEvent(event: SecurityEvent): void {
  const timestamp = new Date().toISOString();
  const parts = [
    `[SECURITY] [${event.type}]`,
    event.ip ? `ip=${event.ip}` : null,
    event.userEmail ? `user=${event.userEmail}` : null,
    event.path ? `path=${event.path}` : null,
    event.details ? `details=${event.details}` : null,
  ].filter(Boolean);

  const message = parts.join(' ');

  // Use warn for blocked/failed events, info for successful security actions
  const isAlert = [
    'AUTH_FAILURE',
    'RATE_LIMIT_HIT',
    'CORS_BLOCKED',
    'PATH_TRAVERSAL_ATTEMPT',
    'CRON_AUTH_FAILURE',
  ].includes(event.type);

  if (isAlert) {
    console.warn(`${timestamp} ${message}`);
  } else {
    console.log(`${timestamp} ${message}`);
  }
}
