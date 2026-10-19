import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/useAppUpdate";

/** "New version available" pop-up for the installed Android app. */
export function UpdatePrompt() {
  const { update, startUpdate, later } = useAppUpdate();
  return (
    <Dialog open={!!update} onOpenChange={(o) => !o && later()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" /> Update available
          </DialogTitle>
          <DialogDescription>
            A new version of Sommyart Music is ready (version 1.0.{update?.latest}, you have 1.0.{update?.installed}).
            Tap Update, open the file when it finishes downloading, then tap Install. Your account, likes and playlists stay as they are.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={later}>Later</Button>
          <Button onClick={startUpdate}>Update now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
