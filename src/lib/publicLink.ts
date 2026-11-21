/** The public web address of the listener app. Share links always point here. */
export const PUBLIC_SITE = "https://sommyart-music.vercel.app";

/**
 * The address to put in a link that other people will open. Inside the Android app the page's own
 * address is "https://localhost", which means nothing on anyone else's phone, so the public site is used.
 */
export function publicOrigin(origin: string = typeof window !== "undefined" ? window.location.origin : ""): string {
  try {
    const u = new URL(origin);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.endsWith(".localhost");
    if (!local && (u.protocol === "https:" || u.protocol === "http:")) return u.origin;
  } catch {
    /* not a web address */
  }
  return PUBLIC_SITE;
}

export const songLink = (id: string) => `${publicOrigin()}/song/${id}`;
export const albumLink = (id: string) => `${publicOrigin()}/album/${id}`;
