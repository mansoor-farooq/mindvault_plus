// In-memory per-email lock for serializing auth operations (register, login, syncLogin)
const locks = new Map<string, Promise<void>>();

export async function withAuthLock<T>(email: string, fn: () => Promise<T>): Promise<T> {
  const normalizedEmail = (email || '').trim().toLowerCase();

  while (locks.get(normalizedEmail)) {
    await locks.get(normalizedEmail);
  }

  let resolveLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  locks.set(normalizedEmail, lockPromise);

  try {
    return await fn();
  } finally {
    locks.delete(normalizedEmail);
    resolveLock!();
  }
}
