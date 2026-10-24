// Called by the Studio app when an artist taps "Generate timing".
// Saves the job (the database rules check the artist owns the song) and, if a GitHub token is configured,
// wakes the background worker straight away.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const REPO = "Sommyart/Sommyart-Music";
const WORKFLOW = "lyrics-align.yml";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authz = req.headers.get("Authorization") ?? "";
  if (!authz.toLowerCase().startsWith("bearer ")) return json({ error: "Please sign in first" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authz } },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return json({ error: "Please sign in first" }, 401);

  let body: { song_id?: string; text?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const songId = String(body.song_id ?? "");
  const text = String(body.text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!/^[0-9a-f-]{36}$/i.test(songId)) return json({ error: "Missing song" }, 400);
  if (text.length < 5) return json({ error: "Paste the lyrics first" }, 400);
  if (text.length > 20000) return json({ error: "Those lyrics are too long" }, 400);

  // Row level security decides whether this person may time this song.
  const { data: job, error } = await sb.from("lyric_jobs").insert({ song_id: songId, lyrics_text: text }).select("id").single();
  if (error) {
    if (error.code === "23505") return json({ error: "Timing for this song is already being worked on" }, 409);
    if (error.code === "42501" || /row-level security/i.test(error.message)) return json({ error: "You can only do this for your own songs" }, 403);
    return json({ error: error.message }, 400);
  }

  // Wake the worker now. Without a token it still runs on its daily check.
  let started = false;
  const token = Deno.env.get("GH_DISPATCH_TOKEN");
  if (token) {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "sommyart-music-lyrics",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      });
      started = res.status === 204;
      if (!started) console.error("dispatch failed", res.status, (await res.text()).slice(0, 300));
    } catch (e) {
      console.error("dispatch error", String(e));
    }
  }
  return json({ job_id: job.id, started });
});
