export function normalizeEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}
