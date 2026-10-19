import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, Loader2, PauseCircle, PlayCircle, User, X } from "lucide-react";
import { supabase } from "./lib";

export type AppRow = {
  id: string; user_id: string; username: string | null; artist_name: string; genre: string | null; description: string | null;
  image_url: string | null; status: "pending" | "approved" | "rejected" | "suspended"; admin_note: string | null;
  artist_id: string | null; created_at: string; reviewed_at: string | null; song_count: number | null;
};

const badge: Record<AppRow["status"], string> = {
  pending: "bg-yellow-500/20 text-yellow-300",
  approved: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
  suspended: "bg-orange-500/20 text-orange-300",
};
const label: Record<AppRow["status"], string> = { pending: "Waiting", approved: "Approved", rejected: "Rejected", suspended: "Paused" };

export function usePendingCount(refreshKey: number, enabled = true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    supabase.rpc("admin_list_artist_applications").then(({ data }: any) => {
      setN((data ?? []).filter((r: AppRow) => r.status === "pending").length);
    });
  }, [refreshKey, enabled]);
  return n;
}

function ReviewDialog({ app, onClose, onDone }: { app: AppRow; onClose: () => void; onDone: () => void }) {
  const [free, setFree] = useState<{ id: string; name: string }[]>([]);
  const [existing, setExisting] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");

  useEffect(() => {
    supabase.from("artists").select("id,name").is("owner_user_id", null).order("name").then(({ data }: any) => setFree(data ?? []));
  }, []);

  const approve = async () => {
    setBusy("approve");
    const { error } = await supabase.rpc("approve_artist_application", { p_application: app.id, p_existing_artist: existing || null });
    setBusy("");
    if (error) return toast.error("Could not approve", { description: error.message });
    toast.success(`${app.artist_name} approved`, { description: "They can now upload tracks and albums." });
    onDone();
    onClose();
  };
  const reject = async () => {
    setBusy("reject");
    const { error } = await supabase.rpc("reject_artist_application", { p_application: app.id, p_note: note });
    setBusy("");
    if (error) return toast.error("Could not reject", { description: error.message });
    toast.success("Request rejected");
    onDone();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{app.artist_name}</DialogTitle>
          <DialogDescription>Applied as @{app.username ?? "unknown"} on {new Date(app.created_at).toLocaleDateString()}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          {app.image_url ? <img src={app.image_url} alt="" className="w-24 h-24 rounded-full object-cover bg-muted shrink-0" /> :
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="w-8 h-8 text-muted-foreground" /></div>}
          <div className="text-sm space-y-1 min-w-0">
            {app.genre && <p><span className="text-muted-foreground">Genre:</span> {app.genre}</p>}
            <p className="whitespace-pre-line break-words">{app.description || "No description"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Profile to give them</Label>
          <select value={existing} onChange={(e) => setExisting(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Create a new artist called "{app.artist_name}"</option>
            {free.map((a) => <option key={a.id} value={a.id}>Link to existing artist: {a.name}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Link to an existing artist if this person is already on Sommyart, so their old songs become theirs.</p>
        </div>
        <div className="space-y-2">
          <Label>Message if you reject (they will see it)</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={reject} disabled={!!busy}>
            {busy === "reject" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-1" />}Reject
          </Button>
          <Button className="flex-1" onClick={approve} disabled={!!busy}>
            {busy === "approve" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RequestsPanel({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<AppRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_artist_applications");
    if (error) toast.error("Could not load requests", { description: error.message });
    setRows(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const toggleAccess = async (a: AppRow) => {
    const pause = a.status === "approved";
    if (pause && !window.confirm(`Pause ${a.artist_name}? They will not be able to upload or edit until you restore them. Their songs stay live.`)) return;
    const { error } = await supabase.rpc("set_artist_access", { p_application: a.id, p_active: !pause });
    if (error) return toast.error("Could not change access", { description: error.message });
    toast.success(pause ? `${a.artist_name} paused` : `${a.artist_name} restored`);
    onChanged();
  };

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const groups: { title: string; items: AppRow[] }[] = [
    { title: "WAITING FOR YOUR APPROVAL", items: rows.filter((r) => r.status === "pending") },
    { title: "ARTIST ACCOUNTS", items: rows.filter((r) => r.status === "approved" || r.status === "suspended") },
    { title: "REJECTED", items: rows.filter((r) => r.status === "rejected") },
  ];

  return (
    <div className="space-y-6">
      {review && <ReviewDialog app={review} onClose={() => setReview(null)} onDone={onChanged} />}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No artist requests yet. Artists create an account on the Studio sign-in page, fill in their details, and appear here for your approval.
        </p>
      )}
      {groups.filter((g) => g.items.length).map((g) => (
        <div key={g.title} className="space-y-2">
          <h3 className="text-sm font-semibold tracking-wider">{g.title} ({g.items.length})</h3>
          {g.items.map((a) => (
            <div key={a.id} className="glass rounded-xl p-3 flex items-center gap-3">
              {a.image_url ? <img src={a.image_url} alt="" className="w-12 h-12 rounded-full object-cover bg-muted shrink-0" /> :
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="w-5 h-5 text-muted-foreground" /></div>}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.artist_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  @{a.username ?? "unknown"}{a.genre ? ` · ${a.genre}` : ""}{a.status === "approved" || a.status === "suspended" ? ` · ${a.song_count ?? 0} songs` : ""}
                </div>
                {a.status === "rejected" && a.admin_note && <div className="text-xs text-muted-foreground truncate">Note: {a.admin_note}</div>}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge[a.status]}`}>{label[a.status]}</span>
              {(a.status === "pending" || a.status === "rejected") && (
                <Button size="sm" variant={a.status === "pending" ? "default" : "secondary"} onClick={() => setReview(a)}>Review</Button>
              )}
              {(a.status === "approved" || a.status === "suspended") && (
                <button onClick={() => toggleAccess(a)} className="p-2 text-muted-foreground hover:text-primary"
                  aria-label={a.status === "approved" ? `Pause ${a.artist_name}` : `Restore ${a.artist_name}`}>
                  {a.status === "approved" ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
