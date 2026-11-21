// Serves /song/:id and /album/:id with the song's (or album's) title, artist and cover in the page's
// link-preview tags, so a shared link shows a proper card on WhatsApp, X, Facebook and others.
// People who open the link get the normal app page; only the preview tags differ.

export const config = { runtime: "edge" };

const SUPABASE_URL = "https://biksluembwawllqdalct.supabase.co";
// The public (publishable) key: the same one the website already ships to every visitor.
const SUPABASE_KEY = "sb_publishable_QYfrSeMI1myHi7G21q-RXA_ozzllW2I";
const SITE = "https://sommyart-music.vercel.app";
const FALLBACK_IMAGE = `${SITE}/icons/icon-512.png`;

type Meta = { title: string; description: string; image: string; url: string; type: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function lookup(kind: "song" | "album", id: string): Promise<Meta | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const table = kind === "song" ? "songs" : "albums";
  const cols = kind === "song" ? "title,artist,cover_art_url" : "title,artist_name,cover_art_url";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=${cols}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const row = (await res.json())?.[0];
  if (!row) return null;
  const artist = kind === "song" ? row.artist : row.artist_name;
  const image = typeof row.cover_art_url === "string" && row.cover_art_url.startsWith("https://") ? row.cover_art_url : FALLBACK_IMAGE;
  return {
    title: `${row.title} · ${artist}`,
    description: kind === "song"
      ? `Listen to ${row.title} by ${artist} on Sommyart Music.`
      : `Listen to the album ${row.title} by ${artist} on Sommyart Music.`,
    image,
    url: `${SITE}/${kind}/${id}`,
    type: kind === "song" ? "music.song" : "music.album",
  };
}

/** Swaps the site-wide preview tags in index.html for ones about this song or album. */
export function withMeta(html: string, m: Meta): string {
  const drop = /\s*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/gi;
  const tags = [
    `<meta name="description" content="${esc(m.description)}">`,
    `<meta property="og:type" content="${m.type}">`,
    `<meta property="og:site_name" content="Sommyart Music">`,
    `<meta property="og:url" content="${esc(m.url)}">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:image" content="${esc(m.image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(m.title)}">`,
    `<meta name="twitter:description" content="${esc(m.description)}">`,
    `<meta name="twitter:image" content="${esc(m.image)}">`,
  ].join("\n    ");
  return html
    .replace(drop, "")
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(m.title)} | Sommyart Music</title>`)
    .replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "album" ? "album" : "song";
  const id = url.searchParams.get("id") ?? "";
  const page = await fetch(new URL("/index.html", url.origin));
  let html = await page.text();
  try {
    const meta = await lookup(kind, id);
    if (meta) html = withMeta(html, meta);
  } catch {
    /* keep the plain page */
  }
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
