import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { supabase as typedClient } from "@/integrations/supabase/client";

// The generated types lag behind the schema (show_until is new).
const supabase = typedClient as any;

type Item = { id: string; title: string; body: string };

/** Joins the current announcements into one line of scrolling text. */
export function tickerText(items: Item[]): string {
  return items
    .map((i) => [i.title.trim(), i.body.trim()].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("   •   ");
}

/**
 * A strip of scrolling text on the home screen with the announcements that are still running
 * (each one has a "show until" date). Tapping it opens the notifications page.
 */
export function AnnouncementTicker() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_notifications")
      .select("id,title,body")
      .eq("kind", "announcement")
      .gt("show_until", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }: { data: Item[] | null }) => {
        if (!cancelled) setItems(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const text = tickerText(items);
  if (!text) return null;
  // Longer text scrolls for longer, so the speed stays easy to read.
  const seconds = Math.max(14, Math.round(text.length / 6));

  return (
    <Link
      to="/notifications"
      aria-label={`Announcements: ${text}`}
      className="mx-4 mb-4 flex items-center gap-2 overflow-hidden rounded-xl border border-primary/30 bg-primary/10 py-2 pl-3"
    >
      <Megaphone size={16} className="shrink-0 text-primary" aria-hidden />
      <div className="ticker-mask relative flex-1 overflow-hidden" aria-hidden>
        <div className="ticker-track flex w-max whitespace-nowrap text-sm text-foreground" style={{ animationDuration: `${seconds}s` }}>
          <span className="pr-12">{text}</span>
          <span className="pr-12">{text}</span>
        </div>
      </div>
    </Link>
  );
}
