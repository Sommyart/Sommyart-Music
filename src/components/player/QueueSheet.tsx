import { ListMusic, Play, Trash2, X, ArrowUp, ArrowDown, Music2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { formatTime } from "@/lib/playback";
import { Track } from "@/lib/tracks";
import { ReactNode } from "react";

const CONTEXT_LABEL: Record<string, string> = {
  library: "Library",
  album: "Album",
  playlist: "Playlist",
  artist: "Artist",
  downloads: "Downloads",
  search: "Search results",
  single: "Single track",
};

function Row({
  track,
  subtitle,
  active,
  onPlay,
  actions,
}: {
  track: Track;
  subtitle?: string;
  active?: boolean;
  onPlay: () => void;
  actions?: ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-2 ${
        active ? "glass neon-border" : "hover:bg-secondary/40"
      }`}
    >
      <button
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
          <img
            src={track.coverUrl}
            alt={`${track.title} artwork`}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p
            className={`text-sm truncate ${
              active ? "text-primary neon-text" : "text-foreground"
            }`}
          >
            {track.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {track.artist}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
      </button>
      {actions}
    </div>
  );
}

export function QueueSheet({ trigger }: { trigger?: ReactNode }) {
  const {
    currentTrack,
    duration,
    queue,
    contextTracks,
    contextIndex,
    contextType,
    playQueueItem,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    playContextIndex,
    addToQueue,
    playNext,
  } = useMusicPlayerContext();

  const upcomingContext = contextTracks
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => i > contextIndex);

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <button
            aria-label="Open queue"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <ListMusic size={22} />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="font-display tracking-widest text-primary text-sm">
            QUEUE
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6">
          {/* Now playing */}
          <section>
            <h3 className="text-[10px] font-display tracking-widest text-muted-foreground mb-2 px-1">
              NOW PLAYING
            </h3>
            {currentTrack ? (
              <Row
                track={currentTrack}
                active
                subtitle={formatTime(duration)}
                onPlay={() => {}}
              />
            ) : (
              <p className="text-xs text-muted-foreground px-1">Nothing playing</p>
            )}
          </section>

          {/* Manual queue */}
          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[10px] font-display tracking-widest text-muted-foreground">
                UP NEXT ({queue.length})
              </h3>
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="text-[10px] font-display tracking-widest text-muted-foreground hover:text-destructive"
                >
                  CLEAR
                </button>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                Nothing queued. Use “Play next” or “Add to queue” on any track.
              </p>
            ) : (
              <div className="space-y-1">
                {queue.map((track, i) => (
                  <Row
                    key={`${track.id}-${i}`}
                    track={track}
                    onPlay={() => playQueueItem(i)}
                    actions={
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => reorderQueue(i, i - 1)}
                          disabled={i === 0}
                          aria-label="Move up"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => reorderQueue(i, i + 1)}
                          disabled={i === queue.length - 1}
                          aria-label="Move down"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => removeFromQueue(i)}
                          aria-label={`Remove ${track.title} from queue`}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Playback context */}
          <section>
            <h3 className="text-[10px] font-display tracking-widest text-muted-foreground mb-2 px-1 flex items-center gap-1">
              <Music2 size={10} /> {CONTEXT_LABEL[contextType] ?? "CONTEXT"} —{" "}
              {upcomingContext.length} remaining
            </h3>
            {upcomingContext.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                End of this {CONTEXT_LABEL[contextType]?.toLowerCase() ?? "context"} — playback
                will stop.
              </p>
            ) : (
              <div className="space-y-1">
                {upcomingContext.map(({ t, i }) => (
                  <Row
                    key={t.id}
                    track={t}
                    onPlay={() => playContextIndex(i)}
                    actions={
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => playNext(t)}
                          aria-label={`Play ${t.title} next`}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary"
                        >
                          <Play size={13} />
                        </button>
                        <button
                          onClick={() => addToQueue(t)}
                          aria-label={`Add ${t.title} to queue`}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary"
                        >
                          <ListMusic size={13} />
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
