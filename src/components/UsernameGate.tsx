import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const DEVICE_KEY = "sommyart_device_id";
const USERNAME_KEY = "sommyart_username";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function UsernameGate() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const check = async () => {
      const deviceId = getOrCreateDeviceId();
      const cached = localStorage.getItem(USERNAME_KEY);
      if (cached) return;

      // Check DB in case user cleared local cache
      const { data } = await supabase
        .from("usernames")
        .select("username")
        .eq("device_id", deviceId)
        .maybeSingle();

      if (data?.username) {
        localStorage.setItem(USERNAME_KEY, data.username);
        return;
      }
      setOpen(true);
    };
    check();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      toast({ title: "Username too short", description: "Use at least 3 characters.", variant: "destructive" });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      toast({ title: "Invalid username", description: "Letters, numbers, and underscores only.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const deviceId = getOrCreateDeviceId();

    // Check uniqueness (case-insensitive)
    const { data: existing } = await supabase
      .from("usernames")
      .select("id")
      .ilike("username", trimmed)
      .maybeSingle();

    if (existing) {
      toast({ title: "Username taken", description: "Please choose another.", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("usernames")
      .insert({ device_id: deviceId, username: trimmed });

    if (error) {
      toast({ title: "Could not save username", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    localStorage.setItem(USERNAME_KEY, trimmed);
    toast({ title: `Welcome, ${trimmed}!`, description: "Enjoy the music." });
    setOpen(false);
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* gate: cannot close */ }}>
      <DialogContent
        className="sm:max-w-sm border-primary/30 bg-background/95 backdrop-blur"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider neon-text">
            Choose Your Username
          </DialogTitle>
          <DialogDescription>
            Pick a unique username to start streaming on Sommyart Music.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Input
            autoFocus
            placeholder="e.g. groove_master"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            className="bg-secondary/50 border-primary/30"
          />
          <Button
            type="submit"
            disabled={submitting || !username.trim()}
            className="w-full"
          >
            {submitting ? "Saving..." : "Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
