import { normalizeEmail } from '../utils';

export function logAuthEvent(level: string, action: string, email: string, reason: string, details: Record<string, unknown> = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'AUTH_AUDIT',
    level,
    action,
    email: normalizeEmail(email),
    reason,
    ...details,
  };
  console.log(JSON.stringify(logEntry));
}
