// Used only by the "Align lyrics" GitHub Action. The Action proves who it is with a short-lived GitHub identity
// token (no password is stored anywhere); this function checks the token came from our repository.
//   peek     -> how many jobs are waiting
//   claim    -> take the next waiting job (returns the lyrics text and the song's audio link)
//   complete -> save the timing result
//   fail     -> record why a job could not be done
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const REPO = "Sommyart/Sommyart-Music";
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "sommyart-lyrics-worker";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const STALE_MINUTES = 45;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function fromOurAction(req: Request) {
  const m = /^bearer (.+)$/i.exec(req.headers.get("Authorization") ?? "");
  if (!m) return false;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, { issuer: ISSUER, audience: AUDIENCE });
    const wf = String(payload.job_workflow_ref ?? "");
    return payload.repository === REPO && wf.startsWith(`${REPO}/.github/workflows/lyrics-align.yml@`);
  } catch (e) {
    console.error("token rejected", String(e));
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await fromOurAction(req))) return json({ error: "Not allowed" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const waiting = `status.eq.pending,and(status.eq.processing,started_at.lt.${staleBefore})`;

  if (body.action === "peek") {
    const { count, error } = await sb.from("lyric_jobs").select("id", { count: "exact", head: true }).or(waiting);
    if (error) return json({ error: error.message }, 500);
    return json({ pending: count ?? 0 });
  }

  if (body.action === "claim") {
    const { data: jobs, error } = await sb.from("lyric_jobs").select("id,song_id,lyrics_text,status")
      .or(waiting).order("created_at", { ascending: true }).limit(1);
    if (error) return json({ error: error.message }, 500);
    const job = jobs?.[0];
    if (!job) return json({ job: null });
    // Take it only if nobody else did first.
    const { data: taken } = await sb.from("lyric_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", job.id).eq("status", job.status).select("id");
    if (!taken?.length) return json({ job: null });
    const { data: song } = await sb.from("songs").select("audio_url,title").eq("id", job.song_id).maybeSingle();
    if (!song?.audio_url) {
      await sb.from("lyric_jobs").update({ status: "failed", error: "The song or its audio file could not be found", finished_at: new Date().toISOString() }).eq("id", job.id);
      return json({ job: null });
    }
    return json({ job: { id: job.id, song_id: job.song_id, lyrics_text: job.lyrics_text, audio_url: song.audio_url, title: song.title } });
  }

  if (body.action === "complete") {
    const r = body.result;
    if (!r || !Array.isArray(r.lines) || r.lines.length > 600) return json({ error: "Bad result" }, 400);
    const { error } = await sb.from("lyric_jobs")
      .update({ status: "done", result: r, error: null, finished_at: new Date().toISOString() })
      .eq("id", String(body.id)).eq("status", "processing");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (body.action === "fail") {
    const { error } = await sb.from("lyric_jobs")
      .update({ status: "failed", error: String(body.error ?? "Unknown problem").slice(0, 500), finished_at: new Date().toISOString() })
      .eq("id", String(body.id)).eq("status", "processing");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
