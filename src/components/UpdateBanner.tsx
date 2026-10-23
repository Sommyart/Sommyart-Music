import { Download } from "lucide-react";
import { useAppUpdate } from "@/hooks/useAppUpdate";

/** A card on the Home screen that stays until the app is updated, even after "Later". */
export function UpdateBanner() {
  const { update, showDialog, openDialog } = useAppUpdate();
  if (!update || showDialog) return null;
  return (
    <button
      onClick={openDialog}
      className="mx-6 mb-3 flex w-[calc(100%-3rem)] items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-left"
    >
      <Download className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-display tracking-wider text-foreground">NEW VERSION AVAILABLE</span>
        <span className="block truncate text-xs text-muted-foreground">
          {update.notes ? update.notes : `Version 1.0.${update.latest} is ready. Tap to update.`}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-display tracking-wider text-primary-foreground">UPDATE</span>
    </button>
  );
}
