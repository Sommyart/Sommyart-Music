import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  cleanCode,
  cleanEmail,
  codeLooksComplete,
  emailProblem,
  ensureProfile,
  finishPasswordChange,
  passwordProblem,
  sendPasswordCode,
} from "@/lib/account";

type Step = "signin" | "signup" | "verify" | "forgot" | "reset";

const TITLES: Record<Step, string> = {
  signin: "Sign In",
  signup: "Create Account",
  verify: "Check Your Email",
  forgot: "Forgot Password",
  reset: "Choose a New Password",
};

const HINTS: Record<Step, string> = {
  signin: "Enter your email and password.",
  signup: "We'll email you a code to confirm the address is yours.",
  verify: "Enter the code we emailed you. It can take a minute, and may land in spam.",
  forgot: "Enter your email and we'll send you a code.",
  reset: "Enter the code we emailed you and your new password.",
};

const field = "bg-secondary/50 border-primary/30";

/** Sign up, sign in and password reset with an email address and emailed codes. */
export function EmailAuthForm({ onHeading }: { onHeading?: (title: string, hint: string) => void }) {
  const [step, setStepRaw] = useState<Step>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const setStep = (s: Step) => {
    setStepRaw(s);
    setCode("");
    if (s !== "verify") setPassword("");
    onHeading?.(TITLES[s], HINTS[s]);
  };

  const fail = (title: string, description?: string) => toast({ title, description, variant: "destructive" });

  const resendSignupCode = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email: cleanEmail(email) });
    if (error) fail("Could not send the code", error.message);
    else toast({ title: "Code sent", description: "Check your email." });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = cleanEmail(email);
    const badEmail = emailProblem(address);
    if (badEmail) return fail("Check your email", badEmail);

    setBusy(true);
    try {
      if (step === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) {
          if (/not confirmed/i.test(error.message)) {
            await resendSignupCode();
            setStep("verify");
            return;
          }
          return fail("Could not sign in", "Wrong email or password.");
        }
        await ensureProfile();
        toast({ title: "Welcome back!" });
      } else if (step === "signup") {
        const badPassword = passwordProblem(password);
        if (badPassword) return fail("Check your password", badPassword);
        if (!name.trim()) return fail("Add your name", "This is the name shown on your profile.");
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { data: { display_name: name.trim().slice(0, 40) } },
        });
        if (error) return fail("Could not create the account", error.message);
        // An address that is already registered comes back with no sign-in methods attached.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          return fail("Already registered", "That email already has an account. Sign in, or reset your password.");
        }
        if (data.session) {
          await ensureProfile(name);
          toast({ title: `Welcome, ${name.trim()}!` });
        } else {
          setStep("verify");
        }
      } else if (step === "verify") {
        if (!codeLooksComplete(code)) return fail("Enter the code", "It is the number in the email we sent.");
        const { error } = await supabase.auth.verifyOtp({ email: address, token: code, type: "signup" });
        if (error) return fail("That code did not work", "It may be wrong or expired. Tap resend for a new one.");
        await ensureProfile(name);
        toast({ title: name.trim() ? `Welcome, ${name.trim()}!` : "Welcome!" });
      } else if (step === "forgot") {
        await sendPasswordCode(address);
        setStep("reset");
        toast({ title: "Code sent", description: "If that email has an account, a code is on its way." });
      } else if (step === "reset") {
        if (!codeLooksComplete(code)) return fail("Enter the code", "It is the number in the email we sent.");
        const badPassword = passwordProblem(password);
        if (badPassword) return fail("Check your password", badPassword);
        await finishPasswordChange(address, code, password);
        await ensureProfile();
        toast({ title: "Password changed", description: "You are signed in." });
      }
    } catch (err: any) {
      fail("Something went wrong", err?.message);
    } finally {
      setBusy(false);
    }
  };

  const needsCode = step === "verify" || step === "reset";
  const needsPassword = step === "signin" || step === "signup" || step === "reset";
  const action =
    step === "signin" ? "Sign In" : step === "signup" ? "Create Account" : step === "verify" ? "Confirm" : step === "forgot" ? "Send Code" : "Change Password";

  const link = (label: string, to: Step, muted = false) => (
    <button
      type="button"
      onClick={() => setStep(to)}
      className={muted ? "text-muted-foreground hover:text-primary hover:underline" : "text-primary hover:underline"}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      {step === "signup" && (
        <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" className={field} />
      )}
      <Input
        type="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        readOnly={needsCode}
        autoComplete="email"
        aria-label="Email"
        className={field}
      />
      {needsCode && (
        <Input
          autoFocus
          inputMode="numeric"
          placeholder="Code from the email"
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          autoComplete="one-time-code"
          aria-label="Code from the email"
          className={`${field} text-center font-mono tracking-[0.3em]`}
        />
      )}
      {needsPassword && (
        <Input
          type="password"
          placeholder={step === "signin" ? "Password" : step === "reset" ? "New password (8 or more characters)" : "Password (8 or more characters)"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={step === "signin" ? "current-password" : "new-password"}
          aria-label="Password"
          className={field}
        />
      )}

      <Button type="submit" disabled={busy || !email.trim()} className="w-full">
        {busy ? "Please wait..." : action}
      </Button>

      <div className="flex flex-col gap-2 text-center text-xs">
        {step === "signin" && (
          <>
            {link("Don't have an account? Sign up", "signup")}
            {link("Forgot your password?", "forgot", true)}
          </>
        )}
        {step === "signup" && link("Already have an account? Sign in", "signin")}
        {step === "verify" && (
          <>
            <button type="button" onClick={resendSignupCode} className="text-primary hover:underline">
              Didn't get it? Resend the code
            </button>
            {link("Use a different email", "signup", true)}
          </>
        )}
        {step === "forgot" && link("Back to sign in", "signin")}
        {step === "reset" && (
          <>
            <button
              type="button"
              onClick={() => sendPasswordCode(email).then(() => toast({ title: "Code sent" })).catch((err) => fail("Could not send the code", err.message))}
              className="text-primary hover:underline"
            >
              Didn't get it? Resend the code
            </button>
            {link("Back to sign in", "signin", true)}
          </>
        )}
      </div>
    </form>
  );
}

export const EMAIL_AUTH_START = { title: TITLES.signin, hint: HINTS.signin };
