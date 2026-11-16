import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Copy, LogOut, User } from "lucide-react";
import { supabase as typedClient } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/useOnline";
import {
  cleanCode,
  codeLooksComplete,
  emailProblem,
  ensureProfile,
  finishAddEmail,
  finishPasswordChange,
  hasPinLogin,
  isPinAccount,
  passwordProblem,
  sendPasswordCode,
  startAddEmail,
  type Profile as ProfileRow,
} from "@/lib/account";
import { uploadAvatar } from "@/lib/avatar";

// The generated types lag behind the schema (new profile columns).
const supabase = typedClient as any;

const STATS = [
  { key: "favourites", label: "Liked songs" },
  { key: "downloads", label: "Downloads" },
  { key: "playlists", label: "Playlists" },
  { key: "artist_follows", label: "Artists followed" },
  { key: "recently_played", label: "Recently played" },
] as const;
type StatKey = (typeof STATS)[number]["key"];

const field = "bg-secondary/50 border-primary/30";
const card = "rounded-xl border border-border/50 p-4 space-y-3";

export default function Profile() {
  const navigate = useNavigate();
  const online = useOnline();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<Partial<Record<StatKey, number>>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  // Password change (email accounts)
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  // New recovery codes (username-and-PIN accounts)
  const [pin, setPin] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [gettingCodes, setGettingCodes] = useState(false);

  // Adding an email to a username-and-PIN account
  const [hasPin, setHasPin] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPin, setAddPin] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addCodeSent, setAddCodeSent] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (cancelled) return;
      setUserId(user.id);
      setEmail(user.email ?? null);
      setHasPin(isPinAccount(user.email));
      hasPinLogin().then((yes) => {
        if (!cancelled && yes) setHasPin(true);
      });
      const row = await ensureProfile();
      if (cancelled) return;
      setProfile(row);
      setName(row?.display_name ?? "");
      setLoading(false);

      const counts = await Promise.all(
        STATS.map(async ({ key }) => {
          const { count, error } = await supabase.from(key).select("*", { count: "exact", head: true }).eq("user_id", user.id);
          return [key, error ? undefined : count ?? 0] as const;
        }),
      );
      if (!cancelled) setStats(Object.fromEntries(counts.filter(([, n]) => n !== undefined)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fail = (title: string, description?: string) => toast({ title, description, variant: "destructive" });
  const realEmail = !!email && !isPinAccount(email);

  const sendAddEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const badEmail = emailProblem(addEmail);
    if (badEmail) return fail("Check your email", badEmail);
    const badPassword = passwordProblem(addPassword);
    if (badPassword) return fail("Check your password", badPassword);
    if (!/^\d{4}$/.test(addPin)) return fail("Enter your PIN", "Your current 4-digit PIN is needed.");
    setAdding(true);
    try {
      await startAddEmail(profile.username, addPin, addEmail);
      setHasPin(true);
      setAddCodeSent(true);
      toast({ title: "Code sent", description: `Check ${addEmail.trim()}. It may land in spam.` });
    } catch (err: any) {
      fail("Could not add the email", err?.message);
    } finally {
      setAdding(false);
    }
  };

  const confirmAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await finishAddEmail(addEmail, addCode, addPassword);
      setEmail(addEmail.trim().toLowerCase());
      setAddCodeSent(false);
      setAddCode("");
      setAddPassword("");
      setAddPin("");
      toast({ title: "Email added", description: "You can now sign in with your email, or with your username and PIN." });
    } catch (err: any) {
      fail("Could not confirm the email", err?.message);
    } finally {
      setAdding(false);
    }
  };
  const shownName = profile?.display_name || profile?.username || "Listener";

  const saveName = async () => {
    const clean = name.trim().slice(0, 40);
    if (!clean || !userId) return fail("Add a name", "Your name cannot be empty.");
    setSavingName(true);
    const { data, error } = await supabase.from("profiles").update({ display_name: clean }).eq("user_id", userId).select().maybeSingle();
    setSavingName(false);
    if (error || !data) return fail("Could not save your name", error?.message);
    setProfile(data);
    toast({ title: "Name saved" });
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file || !userId) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(userId, file);
      const { data, error } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", userId).select().maybeSingle();
      if (error || !data) throw new Error(error?.message || "Could not save the photo");
      setProfile(data);
      toast({ title: "Photo updated" });
    } catch (err: any) {
      fail("Could not update the photo", err?.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const sendCode = async () => {
    if (!email) return;
    setChanging(true);
    try {
      await sendPasswordCode(email);
      setCodeSent(true);
      toast({ title: "Code sent", description: `Check ${email}. It may land in spam.` });
    } catch (err: any) {
      fail("Could not send the code", err?.message);
    } finally {
      setChanging(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!codeLooksComplete(code)) return fail("Enter the code", "It is the number in the email we sent.");
    const bad = passwordProblem(newPassword);
    if (bad) return fail("Check your password", bad);
    setChanging(true);
    try {
      await finishPasswordChange(email, code, newPassword);
      setCodeSent(false);
      setCode("");
      setNewPassword("");
      toast({ title: "Password changed" });
    } catch (err: any) {
      fail("Could not change the password", err?.message);
    } finally {
      setChanging(false);
    }
  };

  const getRecoveryCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !/^\d{4}$/.test(pin)) return fail("Enter your PIN", "Your current 4-digit PIN is needed.");
    setGettingCodes(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-pin", {
        body: { action: "regenerate_codes", username: profile.username, pin },
      });
      if (error || data?.error || !data?.recoveryCodes) throw new Error(data?.error || "Wrong PIN, or the service is unreachable.");
      setNewCodes(data.recoveryCodes);
      setPin("");
    } catch (err: any) {
      fail("Could not make new codes", err?.message);
    } finally {
      setGettingCodes(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen pb-40 bg-background">
      <header className="sticky top-0 z-10 glass-strong border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 -ml-2 text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="font-display tracking-wider text-lg flex-1">Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
        {loading && <p className="text-center text-sm text-muted-foreground py-12">Loading…</p>}
        {!loading && !userId && (
          <p className="text-center text-sm text-muted-foreground py-12">Sign in to see your profile.</p>
        )}

        {!loading && userId && (
          <>
            <section className="flex flex-col items-center gap-3 text-center">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading || !online}
                aria-label="Change profile photo"
                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/50 bg-secondary/50 flex items-center justify-center"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
                <span className="absolute bottom-0 inset-x-0 bg-background/70 py-1 flex justify-center">
                  <Camera size={14} />
                </span>
              </button>
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
              <div>
                <p className="font-display tracking-wider text-lg">{shownName}</p>
                <p className="text-xs text-muted-foreground">
                  {uploading ? "Uploading photo…" : [hasPin ? `@${profile?.username ?? ""}` : "", realEmail ? email : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
            </section>

            {!online && <p className="text-center text-xs text-muted-foreground">You are offline. Changes need an internet connection.</p>}

            <section className="grid grid-cols-2 sm:grid-cols-5 gap-2" aria-label="Your listening">
              {STATS.map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-border/50 p-3 text-center">
                  <p className="text-xl font-display neon-text">{stats[key] ?? "–"}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </section>

            <section className={card}>
              <h2 className="text-sm font-display tracking-wider">Display name</h2>
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name" aria-label="Display name" className={field} />
                <Button onClick={saveName} disabled={savingName || !online || name.trim() === (profile?.display_name ?? "")}>
                  {savingName ? "Saving…" : "Save"}
                </Button>
              </div>
            </section>

            {!realEmail && (
              <section className={card}>
                <h2 className="text-sm font-display tracking-wider">Add an email (optional)</h2>
                <p className="text-xs text-muted-foreground">
                  Add an email and password to sign in either way, and to reset things by email if you forget.
                  Your username and PIN keep working.
                </p>
                {!addCodeSent ? (
                  <form onSubmit={sendAddEmailCode} className="space-y-2">
                    <Input type="email" inputMode="email" placeholder="you@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} autoComplete="email" aria-label="Email" className={field} />
                    <Input type="password" placeholder="New password (8 or more characters)" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} autoComplete="new-password" aria-label="New password" className={field} />
                    <Input type="password" inputMode="numeric" maxLength={4} placeholder="Current PIN" value={addPin} onChange={(e) => setAddPin(e.target.value.replace(/\D/g, ""))} aria-label="Current PIN" className={field} />
                    <Button type="submit" variant="outline" disabled={adding || !online}>{adding ? "Please wait…" : "Send code"}</Button>
                  </form>
                ) : (
                  <form onSubmit={confirmAddEmail} className="space-y-2">
                    <p className="text-xs text-muted-foreground break-all">
                      We emailed {addEmail.trim()}. Enter the code from the email. If it has a link instead, open the link, come back here and tap Confirm.
                    </p>
                    <Input
                      inputMode="numeric"
                      placeholder="Code from the email"
                      value={addCode}
                      onChange={(e) => setAddCode(cleanCode(e.target.value))}
                      autoComplete="one-time-code"
                      aria-label="Code from the email"
                      className={`${field} text-center font-mono tracking-[0.3em]`}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={adding} className="flex-1">{adding ? "Please wait…" : "Confirm email"}</Button>
                      <Button type="button" variant="ghost" onClick={() => { setAddCodeSent(false); setAddCode(""); }}>Back</Button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {realEmail && (
              <section className={card}>
                <h2 className="text-sm font-display tracking-wider">Email and password</h2>
                <p className="text-sm text-muted-foreground break-all">{email}</p>
                {!codeSent ? (
                  <Button variant="outline" onClick={sendCode} disabled={changing || !online}>
                    {changing ? "Sending…" : "Change password"}
                  </Button>
                ) : (
                  <form onSubmit={changePassword} className="space-y-2">
                    <p className="text-xs text-muted-foreground">We emailed you a code. Enter it with your new password.</p>
                    <Input
                      inputMode="numeric"
                      placeholder="Code from the email"
                      value={code}
                      onChange={(e) => setCode(cleanCode(e.target.value))}
                      autoComplete="one-time-code"
                      aria-label="Code from the email"
                      className={`${field} text-center font-mono tracking-[0.3em]`}
                    />
                    <Input
                      type="password"
                      placeholder="New password (8 or more characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      aria-label="New password"
                      className={field}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={changing} className="flex-1">{changing ? "Please wait…" : "Change password"}</Button>
                      <Button type="button" variant="ghost" onClick={() => { setCodeSent(false); setCode(""); setNewPassword(""); }}>Cancel</Button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {hasPin && (
              <section className={card}>
                <h2 className="text-sm font-display tracking-wider">Recovery codes</h2>
                <p className="text-xs text-muted-foreground">
                  Recovery codes reset a forgotten PIN for your username{profile ? ` (${profile.username})` : ""}.
                  Making new codes cancels the old ones.
                </p>
                {newCodes ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 rounded-md border border-primary/30 bg-secondary/40 p-3 font-mono text-sm">
                      {newCodes.map((c) => <div key={c} className="tracking-wider">{c}</div>)}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(newCodes.join("\n")).then(() => toast({ title: "Copied" }))}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy codes
                    </Button>
                    <p className="text-xs text-muted-foreground">Save these somewhere safe now. They will not be shown again.</p>
                  </>
                ) : (
                  <form onSubmit={getRecoveryCodes} className="flex gap-2">
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Current PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      aria-label="Current PIN"
                      className={field}
                    />
                    <Button type="submit" variant="outline" disabled={gettingCodes || !online}>
                      {gettingCodes ? "Please wait…" : "New codes"}
                    </Button>
                  </form>
                )}
              </section>
            )}

            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
