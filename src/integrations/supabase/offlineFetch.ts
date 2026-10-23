/**
 * Keeps the last good copy of every data request (albums, artists, playlists,
 * favourites, lyrics and so on) on the phone.
 *
 * Online, nothing changes: the live answer is used and a copy is saved. With no
 * internet, or a connection too slow to answer, the saved copy is used instead,
 * so screens that were opened before still fill in. Only reads are handled;
 * writes (likes, playlist edits) still need a connection.
 */

export const API_CACHE = "sommyart-api-v1";

const LAST_USER_KEY = "sommyart.lastUser";

/**
 * The signed-in user's id, so one person's saved data is never shown to another.
 * When a login has run out and cannot be renewed offline, requests fall back to
 * the public key, so the last known user stands in for them.
 */
function whoIs(authorization: string): string {
  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (payload) {
      const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof json.sub === "string") {
        localStorage.setItem(LAST_USER_KEY, json.sub);
        return json.sub;
      }
    }
  } catch {
    /* fall through */
  }
  try {
    return localStorage.getItem(LAST_USER_KEY) || "anon";
  } catch {
    return "anon";
  }
}

export const offlineFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : null;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  if (method !== "GET" || !url.includes("/rest/v1/") || typeof caches === "undefined") {
    return fetch(input, init);
  }
  const headers = new Headers(init?.headers ?? request?.headers);
  const key = `${window.location.origin}/__api/${whoIs(headers.get("Authorization") ?? "")}/${encodeURIComponent(url)}`;
  try {
    const res = await fetch(input, init);
    if (res.ok) {
      const copy = res.clone();
      void caches
        .open(API_CACHE)
        .then((c) => c.put(key, copy))
        .catch(() => {});
    }
    return res;
  } catch (err) {
    try {
      const hit = await (await caches.open(API_CACHE)).match(key);
      if (hit) return hit;
    } catch {
      /* nothing saved */
    }
    throw err;
  }
};

/** Forget saved data (used when someone signs out). */
export function clearSavedData() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* noop */
  }
  try {
    if (typeof caches !== "undefined") void caches.delete(API_CACHE);
  } catch {
    /* noop */
  }
}

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

/**
 * With no internet a login that has run out of time cannot be renewed, and the
 * login library keeps retrying for about 25 seconds before giving up, which
 * freezes every screen. While the phone is offline, an out-of-date login is
 * therefore treated as still good for a few minutes. Nothing is changed in
 * storage: once the connection is back the real expiry applies and the login
 * is renewed normally.
 */
export function offlineSafeStorage(base: AuthStorage | undefined): AuthStorage | undefined {
  if (!base) return base;
  return {
    getItem: async (key) => {
      const raw = await base.getItem(key);
      if (!raw || !/-auth-token$/.test(key) || typeof navigator === "undefined" || navigator.onLine !== false) return raw;
      try {
        const session = JSON.parse(raw);
        const now = Math.floor(Date.now() / 1000);
        if (typeof session.expires_at === "number" && session.expires_at < now + 90) {
          session.expires_at = now + 600;
          return JSON.stringify(session);
        }
      } catch {
        /* leave it as it is */
      }
      return raw;
    },
    setItem: (key, value) => base.setItem(key, value),
    removeItem: (key) => base.removeItem(key),
  };
}
