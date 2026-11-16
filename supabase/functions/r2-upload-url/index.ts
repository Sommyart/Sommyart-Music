import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch";

// Gives a signed-in person a short-lived link to upload one file straight to R2.
// The R2 keys never leave this function. Who may upload where:
//   music, covers: admins anywhere; approved artists only in artists/<their user id>/...
//   avatars: any signed-in person, only in <their user id>/..., small pictures only

const PUBLIC_BASE = "https://pub-d871fc1e9c284711846ff7b27f8f8f1b.r2.dev";
const CACHE = "public, max-age=31536000, immutable";
const MAX_MB = { music: 50, covers: 20, avatars: 2 } as const;
type Bucket = keyof typeof MAX_MB;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const need = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ACCOUNT_ID", "R2_BUCKET"];
  if (need.some((k) => !Deno.env.get(k))) return json({ error: "Uploads are not set up yet" }, 500);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await sb.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Please sign in" }, 401);

  let body: { bucket?: string; path?: string; contentType?: string; size?: number } = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const path = String(body.path ?? "");
  const contentType = String(body.contentType ?? "application/octet-stream");
  const size = Number(body.size ?? 0);

  if (body.bucket !== "music" && body.bucket !== "covers" && body.bucket !== "avatars") return json({ error: "Unknown folder" }, 400);
  const bucket: Bucket = body.bucket;
  if (!/^[A-Za-z0-9._\/-]{1,200}$/.test(path) || path.includes("..") || path.startsWith("/") || path.includes("//")) {
    return json({ error: "Unexpected file name" }, 400);
  }
  if (!(size > 0) || size > MAX_MB[bucket] * 1024 * 1024) return json({ error: `File must be under ${MAX_MB[bucket]} MB` }, 400);
  const okType = bucket === "music"
    ? /^(audio\/|video\/mp4$|application\/octet-stream$)/.test(contentType)
    : bucket === "avatars"
    ? /^image\/(jpeg|png|webp)$/.test(contentType)
    : /^image\//.test(contentType);
  if (!okType) return json({ error: "That file type is not allowed here" }, 400);

  // Who may upload here?
  let allowed = false;
  if (bucket === "avatars") {
    allowed = path.startsWith(`${user.id}/`);
  } else {
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    allowed = isAdmin === true;
    if (!allowed && path.startsWith(`artists/${user.id}/`)) {
      const { data: app } = await sb.from("artist_applications").select("id").eq("user_id", user.id).eq("status", "approved").limit(1);
      allowed = (app?.length ?? 0) > 0;
    }
  }
  if (!allowed) return json({ error: "You are not allowed to upload here" }, 403);

  const aws = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });
  const key = `${bucket}/${path}`;
  const target = new URL(`https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${Deno.env.get("R2_BUCKET")}/${key.split("/").map(encodeURIComponent).join("/")}`);
  target.searchParams.set("X-Amz-Expires", "900");
  const signed = await aws.sign(new Request(target, { method: "PUT", headers: { "Cache-Control": CACHE } }), { aws: { signQuery: true } });

  return json({ uploadUrl: signed.url, publicUrl: `${PUBLIC_BASE}/${key}`, cacheControl: CACHE });
});
