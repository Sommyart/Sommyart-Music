import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Smartphone, Monitor, Tablet, Volume2, Bluetooth, Check, Trash2, Pencil } from "lucide-react";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Props {
  trigger: React.ReactNode;
}

function kindIcon(kind: string) {
  if (kind === "mobile") return Smartphone;
  if (kind === "tablet") return Tablet;
  return Monitor;
}

function outputIcon(label: string | null | undefined) {
  if (!label) return Volume2;
  if (/bluetooth|airpods|buds|headset|wireless/i.test(label)) return Bluetooth;
  return Volume2;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "active now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function DeviceSheet({ trigger }: Props) {
  const { devices, thisDevice, activeDevice, transferTo, renameDevice, removeDevice, activeTrack } = useMusicPlayerContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (id: string, current: string) => {
    setEditingId(id);
    setEditName(current);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    await renameDevice(editingId, name);
    toast({ title: "Renamed", description: `Device is now "${name}".` });
    setEditingId(null);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="bg-background/95 backdrop-blur border-primary/30 max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display tracking-wider neon-text text-center">
            Connect to a device
          </SheetTitle>
        </SheetHeader>

        <p className="text-xs text-muted-foreground text-center mt-2">
          {activeDevice ? (
            <>Playing on <span className="text-primary">{activeDevice.name}</span></>
          ) : (
            "No active device"
          )}
        </p>

        <div className="space-y-2 mt-4">
          {devices.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No other devices yet. Sign in on a PC or another phone to see it here.
            </p>
          )}

          {devices.map((d) => {
            const KindIcon = kindIcon(d.kind);
            const OutIcon = outputIcon(d.output_label);
            const isActive = activeDevice?.id === d.id;
            const isThis = thisDevice?.id === d.id;

            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  isActive
                    ? "border-primary bg-primary/10 neon-glow"
                    : "border-border/40 hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      isActive ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"
                    )}
                  >
                    <KindIcon size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingId === d.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm bg-secondary/50"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        />
                        <Button size="sm" className="h-7 px-2" onClick={saveEdit}>OK</Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          {isThis && (
                            <span className="text-[10px] uppercase tracking-wider text-primary/80 border border-primary/30 rounded px-1">
                              this
                            </span>
                          )}
                        </div>
                        {isActive && activeTrack && (
                          <p className="text-[11px] text-primary truncate mt-0.5">Playing: {activeTrack.title}</p>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <OutIcon size={11} className="text-muted-foreground" />
                          <p className="text-[11px] text-muted-foreground truncate">
                            {d.output_label || "Default output"} · {timeAgo(d.last_seen_at)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isActive ? (
                      <Check size={18} className="text-primary mr-1" />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-primary/40 hover:bg-primary/10"
                        onClick={() => transferTo(d.id)}
                      >
                        Transfer
                      </Button>
                    )}
                    {isThis && editingId !== d.id && (
                      <button
                        onClick={() => startEdit(d.id, d.name)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        aria-label="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {!isThis && (
                      <button
                        onClick={() => removeDevice(d.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
