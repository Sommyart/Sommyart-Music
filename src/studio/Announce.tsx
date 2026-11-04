import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "./lib";

type Row = { id: string; title: string; body: string; created_at: string };

/** Post an announcement that appears in every listener's notification list and as an alert on their phone. */
export function AnnouncePanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("app_notifications").select("id,title,body,created_at").eq("kind", "announcement")
      .order("created_at", { ascending: false }).limit(20);
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Write a headline first");
    setBusy(true);
    const { error } = await supabase.from("app_notifications").insert({
      kind: "announcement", title: title.trim(), body: body.trim(), route: "/notifications",
    });
    setBusy(false);
    if (error) return toast.error("Could not post it", { description: error.message });
    toast.success("Announcement sent", { description: "Listeners see it in their notifications." });
    setTitle(""); setBody("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("app_notifications").delete().eq("id", id);
    if (error) return toast.error("Could not remove it", { description: error.message });
    setRows((r) => r.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={post} className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary"><Megaphone className="w-4 h-4" /><h2 className="font-semibold text-sm">New announcement</h2></div>
        <div className="space-y-1">
          <Label htmlFor="ann-title">Headline</Label>
          <Input id="ann-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="For example: New feature, or Studio news" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ann-body">Message (optional)</Label>
          <Textarea id="ann-body" value={body} maxLength={300} rows={4} onChange={(e) => setBody(e.target.value)} placeholder="A short note for your listeners" />
          <p className="text-[11px] text-muted-foreground text-right">{body.length}/300</p>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}Send to everyone
        </Button>
        <p className="text-[11px] text-muted-foreground">It appears at once in the notification list of everyone who has the app open, and as an alert on their phone while the app is running.</p>
      </form>

      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Recent announcements</h3>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border/50 p-3 flex gap-3 items-start">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.title}</p>
              {r.body && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{r.body}</p>}
              <p className="text-[11px] text-muted-foreground/80 mt-1">{new Date(r.created_at).toLocaleString()}</p>
            </div>
            <button onClick={() => remove(r.id)} aria-label="Remove announcement" className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
