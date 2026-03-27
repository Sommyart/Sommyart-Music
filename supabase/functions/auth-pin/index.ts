import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, username, pin, newPin } = await req.json();

    if (!username || !pin) {
      return new Response(JSON.stringify({ error: "Username and PIN are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Use a fake email derived from username
    const email = `${username.toLowerCase().trim()}@sommyart.app`;
    // Pad PIN to meet Supabase min password length (6 chars)
    const password = `pin_${pin}_sa`;

    if (action === "signup") {
      // Check if username already exists in profiles
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Username already taken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create user in auth
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

      // Create profile
      await adminClient.from("profiles").insert({
        user_id: authData.user.id,
        username: username.toLowerCase().trim(),
      });

      // Assign default role
      await adminClient.from("user_roles").insert({
        user_id: authData.user.id,
        role: "user",
      });

      // Sign in to get session
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

      return new Response(JSON.stringify({ session: session.session, user: authData.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find user by username
      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("username", username.toLowerCase().trim())
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Username not found" }), {
          status: 404,
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

      return new Response(JSON.stringify({ success: true }), {
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
