import { Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAppUpdate } from "@/hooks/useAppUpdate";

/** "New version available" pop-up for the installed Android app. Downloads and installs the update inside the app. */
export function UpdatePrompt() {
  const { update, showDialog, phase, progress, error, startUpdate, later, browserDownload } = useAppUpdate();
  const busy = phase === "downloading";
  return (
    <Dialog open={showDialog} onOpenChange={(o) => !o && !busy && later()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" /> Update available
          </DialogTitle>
          <DialogDescription>
            A new version of Sommyart Music is ready (version 1.0.{update?.latest}, you have 1.0.{update?.installed}).
            {update?.notes ? ` What's new: ${update.notes}` : ""}
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <p className="text-sm text-muted-foreground">
            Tap Update now. The update downloads here, then Android asks you to confirm. Your account, likes, playlists and downloads stay as they are.
          </p>
        )}
        {phase === "needs-permission" && (
          <p className="text-sm text-muted-foreground">
            Android needs your OK first. Turn on "Allow from this source" for Sommyart Music on the screen that opened, then come back here. The update will carry on by itself.
          </p>
        )}
        {busy && (
          <div className="space-y-2">
            <Progress value={progress >= 0 ? Math.round(progress * 100) : undefined} />
            <p className="text-sm text-muted-foreground">
              Downloading{progress >= 0 ? ` ${Math.round(progress * 100)}%` : ""}. Keep the app open.
            </p>
          </div>
        )}
        {phase === "installing" && (
          <p className="text-sm text-muted-foreground">
            Tap <strong>Install</strong> in the Android window that opened. If it did not appear, tap Install again below.
          </p>
        )}
        {phase === "error" && (
          <p className="text-sm text-destructive">
            {error} You can try again, or download it with your browser instead.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!busy && <Button variant="secondary" onClick={later}>Later</Button>}
          {phase === "error" && <Button variant="secondary" onClick={browserDownload}>Use browser</Button>}
          <Button onClick={startUpdate} disabled={busy}>
            {busy ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Downloading</>) : phase === "installing" ? "Install again" : phase === "error" ? "Try again" : "Update now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
