import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Disc3, Megaphone, Music2, Settings2 } from "lucide-react";
import { useNotifications, AppNotification } from "@/contexts/NotificationsContext";
import { NotificationSettingsDialog } from "@/components/NotificationPrompt";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const iconFor = (k: AppNotification["kind"]) => (k === "album" ? Disc3 : k === "announcement" ? Megaphone : Music2);

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const { items, isUnread, markAllRead, loading } = useNotifications();
  const [settings, setSettings] = useState(false);
  // What was unread when the page opened stays highlighted while you read it.
  const unreadAtOpen = useRef<Set<string> | null>(null);
  if (!loading && unreadAtOpen.current === null) unreadAtOpen.current = new Set(items.filter(isUnread).map((n) => n.id));
  useEffect(() => {
    if (!loading) markAllRead();
  }, [loading, markAllRead]);

  return (
    <div className="min-h-screen pb-40 bg-background">
      <header className="sticky top-0 z-10 glass-strong border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 -ml-2 text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="font-display tracking-wider text-lg flex-1">Notifications</h1>
          <button onClick={() => setSettings(true)} aria-label="Notification settings" className="p-2 text-muted-foreground hover:text-foreground"><Settings2 size={18} /></button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-2">
        {loading && <p className="text-center text-sm text-muted-foreground py-12">Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing here yet. New songs, albums and announcements will show up here.</p>
          </div>
        )}
        {items.map((n) => {
          const Icon = iconFor(n.kind);
          const fresh = unreadAtOpen.current?.has(n.id);
          return (
            <button
              key={n.id}
              onClick={() => n.route && navigate(n.route)}
              className={cn(
                "w-full text-left rounded-xl border p-3 flex gap-3 items-start transition-colors",
                fresh ? "border-primary/60 bg-primary/10" : "border-border/50",
                n.kind === "announcement" && "border-amber-400/50 bg-amber-400/5",
              )}
            >
              <div className="w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                <Icon size={18} className={n.kind === "announcement" ? "text-amber-300" : "text-primary"} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{n.body}</p>}
                <p className="text-[11px] text-muted-foreground/80 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              {fresh && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" aria-label="New" />}
            </button>
          );
        })}
      </main>
      <NotificationSettingsDialog open={settings} onOpenChange={setSettings} />
    </div>
  );
}
