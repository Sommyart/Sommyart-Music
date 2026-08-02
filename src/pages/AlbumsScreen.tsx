import { useNavigate } from "react-router-dom";
import { Disc3 } from "lucide-react";
import { useAlbums } from "@/hooks/useAlbums";
import { SEO } from "@/components/SEO";

const AlbumsScreen = () => {
  const { albums, loading } = useAlbums();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-36">
      <SEO
        title="Albums — Sommyart Music"
        description="Browse every album on Sommyart Music, including Afro-Hebrew worship records from Sommyart Gospel Band."
        path="/albums"
      />
      <header className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold tracking-wider text-foreground neon-text">
          Albums
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Full bodies of work</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : albums.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">No albums yet</p>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-4">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => navigate(`/album/${album.id}`)}
              className="text-left group"
            >
              <div className="aspect-square rounded-2xl overflow-hidden glass neon-border mb-2">
                <img
                  src={album.coverUrl}
                  alt={`${album.title} album cover`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <p className="text-sm font-medium text-foreground truncate">{album.title}</p>
              <p className="text-xs text-muted-foreground truncate">{album.artistName}</p>
              <p className="text-[10px] text-primary/80 flex items-center gap-1 mt-0.5">
                <Disc3 size={10} /> {album.trackCount ?? 0} tracks
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlbumsScreen;
