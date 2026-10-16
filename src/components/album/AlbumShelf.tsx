import { useNavigate } from "react-router-dom";
import { Disc3 } from "lucide-react";
import { useAlbums } from "@/hooks/useAlbums";

/** Horizontal album shelf for the home screen. */
export function AlbumShelf() {
  const { albums, loading } = useAlbums();
  const navigate = useNavigate();

  if (loading || albums.length === 0) return null;

  return (
    <section className="px-4 mb-6">
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <Disc3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-display tracking-widest text-primary">ALBUMS</h2>
        </div>
        <button
          onClick={() => navigate("/albums")}
          className="text-[10px] font-display tracking-wider text-muted-foreground hover:text-primary"
        >
          SEE ALL
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 px-2">
        {albums.map((album) => (
          <button
            key={album.id}
            onClick={() => navigate(`/album/${album.id}`)}
            className="w-36 shrink-0 text-left"
          >
            <div className="w-36 h-36 rounded-2xl overflow-hidden glass neon-border mb-2">
              <img
                src={album.coverUrl}
                alt={`${album.title} album cover`}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs font-medium text-foreground truncate">{album.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{album.artistName}</p>
            <p className="text-[10px] text-primary/80">{album.trackCount ?? 0} tracks</p>
          </button>
        ))}
      </div>
    </section>
  );
}
