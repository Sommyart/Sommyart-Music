import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECOVERY_CODE_COUNT = 6;

// Generate a single user-friendly recovery code: 4 groups of 4 chars (no ambiguous chars)
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const chars = Array.from(buf, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}`;
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function hashCode(normalized: string): Promise<string> {
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, username, pin, newPin, recoveryCode } = await req.json();

    if (!username || typeof username !== "string") {
      return new Response(JSON.stringify({ error: "Username is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedUsernameEarly = username.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsernameEarly)) {
      return new Response(
        JSON.stringify({ error: "Username must be 3-20 characters: letters, numbers, or underscores" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For signup/login, PIN required. For reset_pin, recoveryCode + newPin required.
    if ((action === "signup" || action === "login") && !/^\d{4}$/.test(pin ?? "")) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const normalizedUsername = username.toLowerCase().trim();
    const email = `${normalizedUsername}@sommyart.app`;
    const password = `pin_${pin}_sa`;

    if (action === "signup") {
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Username already taken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("profiles").insert({
        user_id: authData.user.id,
        username: normalizedUsername,
      });

      await adminClient.from("user_roles").insert({
        user_id: authData.user.id,
        role: "user",
      });

      // Generate recovery codes
      const codes: string[] = [];
      const rows: { user_id: string; code_hash: string }[] = [];
      for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
        const code = generateRecoveryCode();
        codes.push(code);
        const hash = await hashCode(normalizeCode(code));
        rows.push({ user_id: authData.user.id, code_hash: hash });
      }
      await adminClient.from("recovery_codes").insert(rows);

      const anonClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return new Response(JSON.stringify({ error: signInError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ session: session.session, user: authData.user, recoveryCodes: codes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "login") {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return new Response(JSON.stringify({ error: "Invalid username or PIN" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ session: session.session, user: session.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_pin") {
      if (!newPin || !/^\d{4}$/.test(newPin)) {
        return new Response(JSON.stringify({ error: "New PIN must be exactly 4 digits" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!recoveryCode || typeof recoveryCode !== "string") {
        return new Response(JSON.stringify({ error: "Recovery code is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      // Always do hash check to avoid timing/enumeration leaks
      const hash = await hashCode(normalizeCode(recoveryCode));

      if (!profile) {
        return new Response(JSON.stringify({ error: "Invalid username or recovery code" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: codeRow } = await adminClient
        .from("recovery_codes")
        .select("id, used_at")
        .eq("user_id", profile.user_id)
        .eq("code_hash", hash)
        .maybeSingle();

      if (!codeRow || codeRow.used_at) {
        return new Response(JSON.stringify({ error: "Invalid username or recovery code" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newPassword = `pin_${newPin}_sa`;
      const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.user_id, {
        password: newPassword,
      });

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Burn the used code
      await adminClient
        .from("recovery_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", codeRow.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "regenerate_codes") {
      // Requires user to be authenticated AND prove current PIN
      if (!/^\d{4}$/.test(pin ?? "")) {
        return new Response(JSON.stringify({ error: "Current PIN required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !session.user) {
        return new Response(JSON.stringify({ error: "Invalid username or PIN" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Invalidate old codes
      await adminClient.from("recovery_codes").delete().eq("user_id", session.user.id);

      const codes: string[] = [];
      const rows: { user_id: string; code_hash: string }[] = [];
      for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
        const code = generateRecoveryCode();
        codes.push(code);
        const hash = await hashCode(normalizeCode(code));
        rows.push({ user_id: session.user.id, code_hash: hash });
      }
      await adminClient.from("recovery_codes").insert(rows);

      return new Response(JSON.stringify({ recoveryCodes: codes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
