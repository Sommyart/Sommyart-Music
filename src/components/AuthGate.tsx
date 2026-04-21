import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "@/hooks/use-toast";

type Mode = "signin" | "signup" | "forgot";

export function AuthGate() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setOpen(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setOpen(!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const resetForm = () => {
    setPin("");
    setNewPin("");
  };

  const validateUsername = (u: string) => {
    if (u.length < 3) {
      toast({ title: "Username too short", description: "Use at least 3 characters.", variant: "destructive" });
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      toast({ title: "Invalid username", description: "Letters, numbers, and underscores only.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const callAuthFn = async (action: "signup" | "login" | "reset_pin", payload: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke("auth-pin", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = username.trim().toLowerCase();
    if (!validateUsername(trimmedUser)) return;

    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (!/^\d{4}$/.test(pin)) {
          toast({ title: "Invalid PIN", description: "PIN must be exactly 4 digits.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const data = await callAuthFn("signup", { username: trimmedUser, pin });
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
        toast({ title: `Welcome, ${trimmedUser}!`, description: "Account created." });
      } else if (mode === "signin") {
        if (!/^\d{4}$/.test(pin)) {
          toast({ title: "Invalid PIN", description: "PIN must be exactly 4 digits.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const data = await callAuthFn("login", { username: trimmedUser, pin });
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
        toast({ title: `Welcome back, ${trimmedUser}!` });
      } else if (mode === "forgot") {
        if (!/^\d{4}$/.test(newPin)) {
          toast({ title: "Invalid new PIN", description: "PIN must be exactly 4 digits.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        await callAuthFn("reset_pin", { username: trimmedUser, pin: "0000", newPin });
        toast({ title: "PIN reset", description: "You can now sign in with your new PIN." });
        setMode("signin");
        resetForm();
      }
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const titles: Record<Mode, string> = {
    signin: "Sign In",
    signup: "Create Account",
    forgot: "Reset Your PIN",
  };

  const descriptions: Record<Mode, string> = {
    signin: "Enter your username and 4-digit PIN.",
    signup: "Pick a unique username and a 4-digit PIN.",
    forgot: "Enter your username and choose a new 4-digit PIN.",
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* gated */ }}>
      <DialogContent
        className="sm:max-w-sm border-primary/30 bg-background/95 backdrop-blur"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider neon-text">
            {titles[mode]}
          </DialogTitle>
          <DialogDescription>{descriptions[mode]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Input
            autoFocus
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            className="bg-secondary/50 border-primary/30"
          />

          {mode !== "forgot" && (
            <div className="flex justify-center">
              <InputOTP maxLength={4} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          )}

          {mode === "forgot" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">New 4-digit PIN</p>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={newPin} onChange={setNewPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || !username.trim()}
            className="w-full"
          >
            {submitting
              ? "Please wait..."
              : mode === "signup"
              ? "Create Account"
              : mode === "signin"
              ? "Sign In"
              : "Reset PIN"}
          </Button>

          <div className="flex flex-col gap-2 text-center text-xs">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => { setMode("signup"); resetForm(); }}
                  className="text-primary hover:underline"
                >
                  Don't have an account? Sign up
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); resetForm(); }}
                  className="text-muted-foreground hover:text-primary hover:underline"
                >
                  Forgot your PIN?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => { setMode("signin"); resetForm(); }}
                className="text-primary hover:underline"
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => { setMode("signin"); resetForm(); }}
                className="text-primary hover:underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
