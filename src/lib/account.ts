import { supabase as typedClient } from "@/integrations/supabase/client";

// The generated types lag behind the schema (new profile columns, new function).
const supabase = typedClient as any;

/** Username-and-PIN accounts are stored with a made-up address on this domain. */
export const PIN_EMAIL_DOMAIN = "@sommyart.app";
export const MIN_PASSWORD = 8;

export type Profile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export const cleanEmail = (raw: string) => raw.trim().toLowerCase();

export const isPinAccount = (email: string | null | undefined) =>
  !!email && email.toLowerCase().endsWith(PIN_EMAIL_DOMAIN);

/** Returns what is wrong with the address, or null when it can be used. */
export function emailProblem(raw: string): string | null {
  const email = cleanEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Enter a valid email address.";
  if (isPinAccount(email)) return "That address cannot be used. Please use your own email.";
  return null;
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > 72) return "Use 72 characters or fewer.";
  return null;
}

/** Codes arrive by email as digits; people paste them with spaces or dashes. */
export const cleanCode = (raw: string) => raw.replace(/\D/g, "").slice(0, 10);
export const codeLooksComplete = (code: string) => code.length >= 6;

/** The profile row of whoever is signed in, created on first use. */
export async function ensureProfile(displayName?: string): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("ensure_my_profile", { p_display_name: displayName?.trim() || null });
  if (error) {
    console.warn("Could not load the profile:", error.message);
    return null;
  }
  return data as Profile;
}

/** Emails a code that lets the owner of the address choose a new password. */
export async function sendPasswordCode(rawEmail: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail(rawEmail));
  if (error) throw new Error(error.message);
}

/** Checks the emailed code, then sets the new password. The person ends up signed in. */
export async function finishPasswordChange(rawEmail: string, code: string, password: string) {
  const { error: codeError } = await supabase.auth.verifyOtp({ email: cleanEmail(rawEmail), token: cleanCode(code), type: "recovery" });
  if (codeError) throw new Error("That code is wrong or has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
