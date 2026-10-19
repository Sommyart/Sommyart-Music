// Sends a push notification (Firebase Cloud Messaging) when songs are published.
// Called by a database trigger (see migration 20261019224500_push_notifications.sql), never by the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* --------------------------- Google OAuth (service account) --------------------------- */

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function googleAccessToken(sa: { client_email: string; private_key: string; token_uri?: string }) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed: ${data.error_description || data.error || res.status}`);
  return data.access_token as string;
}

/* --------------------------------------- Handler -------------------------------------- */

type Song = { id: string; title: string; artist: string; artist_id: string | null; album_id: string | null; song_artists?: { artist_id: string }[] };

function describe(songs: Song[], personal: boolean) {
  const first = songs[0];
  const sameAlbum = songs.length > 1 && songs.every((s) => s.album_id && s.album_id === first.album_id);
  const sameArtist = songs.every((s) => s.artist_id === first.artist_id);
  if (songs.length === 1) {
    return {
      title: personal ? `${first.artist} just released a new song` : "New song on Sommyart Music",
      body: personal ? first.title : `${first.title} by ${first.artist}`,
      route: `/song/${first.id}`,
    };
  }
  if (sameAlbum) {
    return {
      title: personal ? `${first.artist} released a new album` : "New album on Sommyart Music",
      body: `${songs.length} new tracks including "${first.title}"`,
      route: `/album/${first.album_id}`,
    };
  }
  return {
    title: personal ? "New songs from artists you follow" : "New songs on Sommyart Music",
    body: sameArtist ? `${songs.length} new songs from ${first.artist}` : `"${first.title}" and ${songs.length - 1} more`,
    route: "/",
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const expected = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!expected || req.headers.get("x-webhook-secret") !== expected) return json({ error: "Not allowed" }, 401);

  const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!saRaw) return json({ error: "FIREBASE_SERVICE_ACCOUNT is not set" }, 503);

  let songIds: string[] = [];
  try {
    const body = await req.json();
    songIds = Array.isArray(body?.song_ids) ? body.song_ids.filter((x: unknown) => typeof x === "string").slice(0, 50) : [];
  } catch {
    return json({ error: "Bad body" }, 400);
  }
  if (!songIds.length) return json({ sent: 0, reason: "no songs" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Collaborators are saved a moment after the song itself; give them time to land.
  await sleep(4000);

  // Claim the songs so a retry can never announce them twice.
  const { data: claimed, error: claimErr } = await db
    .from("push_sent_songs")
    .upsert(songIds.map((song_id) => ({ song_id })), { onConflict: "song_id", ignoreDuplicates: true })
    .select("song_id");
  if (claimErr) return json({ error: claimErr.message }, 500);
  const claimedIds = (claimed ?? []).map((r: { song_id: string }) => r.song_id);
  if (!claimedIds.length) return json({ sent: 0, reason: "already announced" });

  const { data: songRows, error: songErr } = await db
    .from("songs")
    .select("id,title,artist,artist_id,album_id,uploaded_at,song_artists(artist_id)")
    .in("id", claimedIds);
  if (songErr) return json({ error: songErr.message }, 500);

  // Ignore anything old (for example a bulk import) so nobody is spammed.
  const cutoff = Date.now() - 15 * 60 * 1000;
  const songs = ((songRows ?? []) as (Song & { uploaded_at: string })[])
    .filter((s) => new Date(s.uploaded_at).getTime() > cutoff)
    .sort((a, b) => a.title.localeCompare(b.title));
  if (!songs.length) return json({ sent: 0, reason: "nothing recent" });

  const artistIds = Array.from(new Set(songs.flatMap((s) => [s.artist_id, ...(s.song_artists ?? []).map((c) => c.artist_id)]).filter(Boolean))) as string[];

  const [{ data: follows }, { data: owners }, { data: tokens }] = await Promise.all([
    db.from("artist_follows").select("user_id").in("artist_id", artistIds),
    db.from("artists").select("owner_user_id").in("id", artistIds),
    db.from("device_push_tokens").select("token,user_id,mode").neq("mode", "off"),
  ]);
  const followers = new Set((follows ?? []).map((f: { user_id: string }) => f.user_id));
  const uploaders = new Set((owners ?? []).map((o: { owner_user_id: string | null }) => o.owner_user_id).filter(Boolean));

  const personalMsg = describe(songs, true);
  const generalMsg = describe(songs, false);
  const targets: { token: string; msg: typeof personalMsg }[] = [];
  for (const t of (tokens ?? []) as { token: string; user_id: string; mode: string }[]) {
    if (uploaders.has(t.user_id)) continue; // the artist who just uploaded does not need a ping
    if (followers.has(t.user_id)) targets.push({ token: t.token, msg: personalMsg });
    else if (t.mode === "all") targets.push({ token: t.token, msg: generalMsg });
  }
  if (!targets.length) return json({ sent: 0, reason: "no recipients" });

  let sa;
  try {
    sa = JSON.parse(saRaw);
  } catch {
    return json({ error: "FIREBASE_SERVICE_ACCOUNT is not valid JSON" }, 503);
  }

  let accessToken: string;
  try {
    accessToken = await googleAccessToken(sa);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;
  let lastError = "";

  for (let i = 0; i < targets.length; i += 25) {
    await Promise.all(targets.slice(i, i + 25).map(async ({ token, msg }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data: { route: msg.route },
            android: { priority: "HIGH", notification: { channel_id: "new_songs", tag: "sommyart-new-song" } },
          },
        }),
      });
      if (res.ok) {
        sent++;
        return;
      }
      failed++;
      const err = await res.json().catch(() => ({}));
      lastError = err?.error?.message ?? String(res.status);
      const code = err?.error?.details?.find?.((d: { errorCode?: string }) => d.errorCode)?.errorCode;
      if (res.status === 404 || code === "UNREGISTERED") dead.push(token);
    }));
  }

  if (dead.length) await db.from("device_push_tokens").delete().in("token", dead);
  return json({ sent, failed, removed: dead.length, lastError: failed ? lastError : undefined });
});
