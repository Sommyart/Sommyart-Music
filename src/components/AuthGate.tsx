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
import { Copy, Download, ShieldCheck } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

export function AuthGate() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Codes shown after successful signup — must be acknowledged before closing.
  const [issuedCodes, setIssuedCodes] = useState<string[] | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setOpen(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Don't auto-close while we're showing recovery codes the user must save.
      if (!session) setOpen(true);
      else if (!issuedCodes) setOpen(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [issuedCodes]);

  const resetForm = () => {
    setPin("");
    setNewPin("");
    setRecoveryCode("");
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

  const callAuthFn = async (
    action: "signup" | "login" | "reset_pin",
    payload: Record<string, string>,
  ) => {
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
          return;
        }
        const data = await callAuthFn("signup", { username: trimmedUser, pin });
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
        setIssuedCodes(data?.recoveryCodes ?? []);
        toast({ title: `Welcome, ${trimmedUser}!`, description: "Save your recovery codes." });
      } else if (mode === "signin") {
        if (!/^\d{4}$/.test(pin)) {
          toast({ title: "Invalid PIN", description: "PIN must be exactly 4 digits.", variant: "destructive" });
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
          return;
        }
        if (!recoveryCode.trim()) {
          toast({ title: "Recovery code required", description: "Enter one of your saved codes.", variant: "destructive" });
          return;
        }
        await callAuthFn("reset_pin", {
          username: trimmedUser,
          pin: "0000",
          newPin,
          recoveryCode: recoveryCode.trim(),
        });
        toast({ title: "PIN reset", description: "Sign in with your new PIN." });
        setMode("signin");
        resetForm();
      }
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCodes = async () => {
    if (!issuedCodes) return;
    await navigator.clipboard.writeText(issuedCodes.join("\n"));
    toast({ title: "Copied", description: "Recovery codes copied to clipboard." });
  };

  const downloadCodes = () => {
    if (!issuedCodes) return;
    const blob = new Blob(
      [`Sommyart Music — Recovery Codes for ${username.trim().toLowerCase()}\n\n${issuedCodes.join("\n")}\n\nKeep these somewhere safe. Each code can only be used once.\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sommyart-recovery-codes-${username.trim().toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const acknowledgeCodes = () => {
    setIssuedCodes(null);
    setOpen(false);
    resetForm();
  };

  // Recovery-codes screen (shown right after signup)
  if (issuedCodes) {
    return (
      <Dialog open={true} onOpenChange={() => { /* gated */ }}>
        <DialogContent
          className="sm:max-w-md border-primary/30 bg-background/95 backdrop-blur"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider neon-text flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Save Your Recovery Codes
            </DialogTitle>
            <DialogDescription>
              These codes are the <strong>only</strong> way to reset your PIN if you forget it.
              Save them somewhere safe — each code works only once.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 rounded-md border border-primary/30 bg-secondary/40 p-3 font-mono text-sm">
            {issuedCodes.map((c) => (
              <div key={c} className="tracking-wider">{c}</div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={copyCodes}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={downloadCodes}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>

          <Button type="button" className="w-full" onClick={acknowledgeCodes}>
            I've saved them — Continue
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  const titles: Record<Mode, string> = {
    signin: "Sign In",
    signup: "Create Account",
    forgot: "Reset Your PIN",
  };
  const descriptions: Record<Mode, string> = {
    signin: "Enter your username and 4-digit PIN.",
    signup: "Pick a unique username and a 4-digit PIN. You'll receive recovery codes.",
    forgot: "Enter your username, a recovery code, and a new 4-digit PIN.",
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
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Recovery code</p>
                <Input
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  className="bg-secondary/50 border-primary/30 font-mono tracking-wider uppercase"
                />
              </div>
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
            </>
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
