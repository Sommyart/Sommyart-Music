const KEY = "sommyart.pendingDestination";

/**
 * Survives full page reloads and auth redirects (localStorage, not in-memory),
 * so a shared /song or /album link is never lost while signing up.
 */
export function setPendingDestination(path: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* noop */
  }
}

export function takePendingDestination(maxAgeMs = 30 * 60 * 1000): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { path?: string; at?: number };
    if (!parsed?.path || !parsed.at || Date.now() - parsed.at > maxAgeMs) return null;
    return parsed.path;
  } catch {
    return null;
  }
}

export function peekPendingDestination(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { path?: string }).path ?? null : null;
  } catch {
    return null;
  }
}
