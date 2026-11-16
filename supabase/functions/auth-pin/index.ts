import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Username-and-PIN accounts. Two kinds exist:
//   - plain: the account's address is <username>@sommyart.app and its password is made from the PIN;
//   - with an email added: the account has a real email and password, and the PIN is
//     checked against public.pin_credentials (with a lock after repeated wrong tries).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECOVERY_CODE_COUNT = 6;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Generate a single user-friendly recovery code: 4 groups of 4 chars (no ambiguous chars)
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const chars = Array.from(buf, (b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function hashCode(normalized: string): Promise<string> {
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const pinPassword = (pin: string) => `pin_${pin}_sa`;
const isPin = (v: unknown): v is string => typeof v === "string" && /^\d{4}$/.test(v);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, username, pin, newPin, recoveryCode } = await req.json();

    if (!username || typeof username !== "string") return json({ error: "Username is required" }, 400);
    const name = username.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) {
      return json({ error: "Username must be 3-20 characters: letters, numbers, or underscores" }, 400);
    }
    if ((action === "signup" || action === "login") && !isPin(pin)) {
      return json({ error: "PIN must be exactly 4 digits" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const newAnon = () => createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const plainEmail = `${name}@sommyart.app`;

    const newRecoveryCodes = async (userId: string) => {
      await admin.from("recovery_codes").delete().eq("user_id", userId);
      const codes: string[] = [];
      const rows: { user_id: string; code_hash: string }[] = [];
      for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
        const code = generateRecoveryCode();
        codes.push(code);
        rows.push({ user_id: userId, code_hash: await hashCode(normalizeCode(code)) });
      }
      await admin.from("recovery_codes").insert(rows);
      return codes;
    };

    // Checks a username and PIN. On success gives the user id, plus a session when the
    // check itself produced one (plain accounts).
    type Checked = { ok: true; userId: string; session?: unknown; user?: unknown } | { ok: false; locked: boolean };
    const checkPin = async (p: string): Promise<Checked> => {
      const { data: profile } = await admin.from("profiles").select("user_id").eq("username", name).maybeSingle();
      if (profile) {
        const { data: verdict } = await admin.rpc("pin_check", { p_user: profile.user_id, p_pin: p });
        if (verdict === "ok") return { ok: true, userId: profile.user_id };
        if (verdict === "locked") return { ok: false, locked: true };
        if (verdict === "wrong") return { ok: false, locked: false };
      }
      const { data, error } = await newAnon().auth.signInWithPassword({ email: plainEmail, password: pinPassword(p) });
      if (error || !data.user) return { ok: false, locked: false };
      return { ok: true, userId: data.user.id, session: data.session, user: data.user };
    };
    const refused = (c: { locked: boolean }) =>
      c.locked
        ? json({ error: "Too many wrong tries. Please wait 15 minutes and try again." }, 429)
        : json({ error: "Invalid username or PIN" }, 401);

    // Signs in an account whose PIN is not its password, using a one-time token made here.
    const openSession = async (userId: string) => {
      const { data: found } = await admin.auth.admin.getUserById(userId);
      const email = found?.user?.email;
      if (!email) return null;
      const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const tokenHash = link?.properties?.hashed_token;
      if (!tokenHash) return null;
      const { data, error } = await newAnon().auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error || !data.session) return null;
      return { session: data.session, user: data.user };
    };

    if (action === "signup") {
      const { data: existing } = await admin.from("profiles").select("id").eq("username", name).maybeSingle();
      if (existing) return json({ error: "Username already taken" }, 400);

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: plainEmail,
        password: pinPassword(pin),
        email_confirm: true,
      });
      if (authError) return json({ error: authError.message }, 400);

      await admin.from("profiles").insert({ user_id: authData.user.id, username: name });
      await admin.from("user_roles").insert({ user_id: authData.user.id, role: "user" });
      const codes = await newRecoveryCodes(authData.user.id);

      const { data: session, error: signInError } = await newAnon().auth.signInWithPassword({
        email: plainEmail,
        password: pinPassword(pin),
      });
      if (signInError) return json({ error: signInError.message }, 400);
      return json({ session: session.session, user: authData.user, recoveryCodes: codes });
    }

    if (action === "login") {
      const checked = await checkPin(pin);
      if (!checked.ok) return refused(checked);
      if (checked.session) return json({ session: checked.session, user: checked.user });
      const opened = await openSession(checked.userId);
      if (!opened) return json({ error: "Could not sign you in. Please try again." }, 500);
      return json(opened);
    }

    if (action === "reset_pin") {
      if (!isPin(newPin)) return json({ error: "New PIN must be exactly 4 digits" }, 400);
      if (!recoveryCode || typeof recoveryCode !== "string") return json({ error: "Recovery code is required" }, 400);

      const { data: profile } = await admin.from("profiles").select("user_id").eq("username", name).maybeSingle();
      // Always do hash check to avoid timing/enumeration leaks
      const hash = await hashCode(normalizeCode(recoveryCode));
      if (!profile) return json({ error: "Invalid username or recovery code" }, 401);

      const { data: codeRow } = await admin
        .from("recovery_codes")
        .select("id, used_at")
        .eq("user_id", profile.user_id)
        .eq("code_hash", hash)
        .maybeSingle();
      if (!codeRow || codeRow.used_at) return json({ error: "Invalid username or recovery code" }, 401);

      const { data: kept } = await admin.from("pin_credentials").select("user_id").eq("user_id", profile.user_id).maybeSingle();
      if (kept) {
        const { error } = await admin.rpc("pin_set", { p_user: profile.user_id, p_pin: newPin });
        if (error) return json({ error: "Could not save the new PIN" }, 400);
      } else {
        const { error } = await admin.auth.admin.updateUserById(profile.user_id, { password: pinPassword(newPin) });
        if (error) return json({ error: error.message }, 400);
      }

      // Burn the used code
      await admin.from("recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", codeRow.id);
      return json({ success: true });
    }

    if (action === "regenerate_codes") {
      if (!isPin(pin)) return json({ error: "Current PIN required" }, 400);
      const checked = await checkPin(pin);
      if (!checked.ok) return refused(checked);
      return json({ recoveryCodes: await newRecoveryCodes(checked.userId) });
    }

    // First step of adding an email: the signed-in owner proves the PIN, and the PIN is
    // stored on its own so it keeps working once the account gets a real email and password.
    if (action === "keep_pin") {
      if (!isPin(pin)) return json({ error: "Current PIN required" }, 400);
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: caller } = await admin.auth.getUser(token);
      if (!caller?.user) return json({ error: "Please sign in first" }, 401);
      const checked = await checkPin(pin);
      if (!checked.ok) return refused(checked);
      if (checked.userId !== caller.user.id) return json({ error: "Invalid username or PIN" }, 401);
      const { error } = await admin.rpc("pin_set", { p_user: checked.userId, p_pin: pin });
      if (error) return json({ error: "Could not keep the PIN" }, 400);
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("auth-pin error:", err);
    return json({ error: "An unexpected error occurred. Please try again." }, 500);
  }
});
