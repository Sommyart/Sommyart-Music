import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFollows } from "@/contexts/FollowsContext";
import { getNotifyMode, showSystemNotification } from "@/lib/notify";

// The generated types do not know this table yet.
const db = supabase as any;

export type AppNotification = {
  id: string;
  kind: "song" | "album" | "announcement";
  title: string;
  body: string;
  route: string | null;
  artist_id: string | null;
  created_at: string;
};

type Ctx = {
  items: AppNotification[];
  unread: number;
  /** Ids that were unread when the list was last opened, so they can stay highlighted. */
  isUnread: (n: AppNotification) => boolean;
  markAllRead: () => void;
  loading: boolean;
};

const NotificationsContext = createContext<Ctx | null>(null);
const READ_KEY = "sommyart.notif.lastRead";

function readLastRead(): number | null {
  try {
    const v = localStorage.getItem(READ_KEY);
    return v ? Date.parse(v) : null;
  } catch {
    return null;
  }
}
function writeLastRead(ms: number) {
  try {
    localStorage.setItem(READ_KEY, new Date(ms).toISOString());
  } catch {
    /* storage unavailable */
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { followedIds } = useFollows();
  const followedRef = useRef(followedIds);
  followedRef.current = followedIds;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRead, setLastRead] = useState<number | null>(() => readLastRead());
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db.from("app_notifications").select("*").order("created_at", { ascending: false }).limit(50);
      if (cancelled) return;
      setItems((data ?? []) as AppNotification[]);
      setLoading(false);
      loadedRef.current = true;
      // First time on this phone: everything already there counts as seen.
      if (readLastRead() === null) {
        const now = Date.now();
        writeLastRead(now);
        setLastRead(now);
      }
    })();

    const channel = supabase
      .channel("app-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_notifications" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string })?.id;
          if (id) setItems((prev) => prev.filter((n) => n.id !== id));
          return;
        }
        const n = payload.new as AppNotification;
        if (!n?.id) return;
        let isNew = false;
        setItems((prev) => {
          const i = prev.findIndex((x) => x.id === n.id);
          if (i === -1) {
            isNew = true;
            return [n, ...prev].slice(0, 50);
          }
          const copy = prev.slice();
          copy[i] = n;
          return copy;
        });
        if (payload.eventType !== "INSERT" || !loadedRef.current) return;

        const mode = getNotifyMode();
        if (mode === "off") return;
        if (mode === "following" && n.kind !== "announcement" && !(n.artist_id && followedRef.current.has(n.artist_id))) return;
        const route = n.route ?? "/notifications";
        toast.success(n.title, {
          description: n.body,
          duration: 8000,
          action: { label: "Open", onClick: () => navigate(route) },
        });
        if (document.visibilityState !== "visible") {
          showSystemNotification({ title: n.title, body: n.body, route, tag: "sommyart-notification" });
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const isUnread = useCallback((n: AppNotification) => lastRead !== null && Date.parse(n.created_at) > lastRead, [lastRead]);
  const unread = useMemo(() => items.filter(isUnread).length, [items, isUnread]);
  const markAllRead = useCallback(() => {
    const now = Date.now();
    writeLastRead(now);
    setLastRead(now);
  }, []);

  return <NotificationsContext.Provider value={{ items, unread, isUnread, markAllRead, loading }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
