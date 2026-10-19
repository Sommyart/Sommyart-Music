import { ListMusic, Play, Trash2, X, Music2, GripVertical, ListEnd } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { formatTime } from "@/lib/playback";
import { Track } from "@/lib/tracks";
import { cn } from "@/lib/utils";
import { ReactNode, useMemo } from "react";

const CONTEXT_LABEL: Record<string, string> = {
  library: "Library",
  album: "Album",
  playlist: "Playlist",
  artist: "Artist",
  downloads: "Downloads",
  search: "Search results",
  single: "Single track",
};

const smallBtn =
  "w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors";

function RowBody({ track, subtitle, active, onPlay }: { track: Track; subtitle?: string; active?: boolean; onPlay: () => void }) {
  return (
    <button onClick={onPlay} aria-label={`Play ${track.title}`} className="flex items-center gap-3 flex-1 min-w-0 text-left">
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-secondary">
        <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0">
        <p className={cn("text-sm truncate", active ? "text-primary neon-text" : "text-foreground")}>{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {track.artist}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>
    </button>
  );
}

function Row({ track, subtitle, active, onPlay, actions }: { track: Track; subtitle?: string; active?: boolean; onPlay: () => void; actions?: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl p-2", active ? "glass neon-border" : "hover:bg-secondary/40")}>
      <RowBody track={track} subtitle={subtitle} active={active} onPlay={onPlay} />
      {actions}
    </div>
  );
}

function SortableRow({
  id, track, index, total, onPlay, onRemove,
}: { id: string; track: Track; index: number; total: number; onPlay: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Only move up and down: drop the sideways part of the drag.
  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 rounded-xl p-2 bg-background/40",
        isDragging ? "relative z-10 glass neon-border shadow-lg opacity-95" : "hover:bg-secondary/40",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${track.title}, position ${index + 1} of ${total}. Press space, then use the arrow keys.`}
        className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={18} />
      </button>
      <RowBody track={track} onPlay={onPlay} />
      <button onClick={onRemove} aria-label={`Remove ${track.title} from queue`} className={cn(smallBtn, "hover:text-destructive")}>
        <X size={16} />
      </button>
    </div>
  );
}

export function QueueSheet({ trigger }: { trigger?: ReactNode }) {
  const {
    currentTrack, duration, queue, contextTracks, contextIndex, contextType,
    playQueueItem, removeFromQueue, reorderQueue, clearQueue, playContextIndex, addToQueue, playNext,
  } = useMusicPlayerContext();

  const upcomingContext = contextTracks.map((t, i) => ({ t, i })).filter(({ i }) => i > contextIndex);

  // Stable ids so a song queued twice still drags correctly.
  const ids = useMemo(() => {
    const seen: Record<string, number> = {};
    return queue.map((t) => {
      seen[t.id] = (seen[t.id] ?? 0) + 1;
      return `${t.id}:${seen[t.id]}`;
    });
  }, [queue]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderQueue(from, to);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <button aria-label="Open queue" className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
            <ListMusic size={22} />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0 lg:max-w-2xl lg:mx-auto lg:rounded-t-2xl">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="font-display tracking-widest text-primary text-sm">QUEUE</SheetTitle>
          <SheetDescription className="sr-only">Songs playing now and coming up next. Drag the handle to reorder.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6">
          <section>
            <h3 className="text-[10px] font-display tracking-widest text-muted-foreground mb-2 px-1">NOW PLAYING</h3>
            {currentTrack ? (
              <Row track={currentTrack} active subtitle={formatTime(duration)} onPlay={() => {}} />
            ) : (
              <p className="text-xs text-muted-foreground px-1">Nothing playing</p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[10px] font-display tracking-widest text-muted-foreground">UP NEXT ({queue.length})</h3>
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  aria-label="Clear queue"
                  className="min-h-9 px-2 flex items-center gap-1 text-[10px] font-display tracking-widest text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={12} /> CLEAR
                </button>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">Nothing queued. Use “Play next” or “Play last” on any song.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1" data-testid="queue-list">
                    {queue.map((track, i) => (
                      <SortableRow
                        key={ids[i]}
                        id={ids[i]}
                        track={track}
                        index={i}
                        total={queue.length}
                        onPlay={() => playQueueItem(i)}
                        onRemove={() => removeFromQueue(i)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>

          <section>
            <h3 className="text-[10px] font-display tracking-widest text-muted-foreground mb-2 px-1 flex items-center gap-1">
              <Music2 size={10} /> {(CONTEXT_LABEL[contextType] ?? "CONTEXT").toUpperCase()} · {upcomingContext.length} REMAINING
            </h3>
            {upcomingContext.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">
                End of this {CONTEXT_LABEL[contextType]?.toLowerCase() ?? "list"}. Playback stops after the last song unless repeat is on.
              </p>
            ) : (
              <div className="space-y-1">
                {upcomingContext.map(({ t, i }) => (
                  <Row
                    key={t.id}
                    track={t}
                    onPlay={() => playContextIndex(i)}
                    actions={
                      <div className="flex items-center shrink-0">
                        <button onClick={() => playNext(t)} aria-label={`Play ${t.title} next`} className={smallBtn}>
                          <Play size={14} />
                        </button>
                        <button onClick={() => addToQueue(t)} aria-label={`Play ${t.title} last`} className={smallBtn}>
                          <ListEnd size={14} />
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
