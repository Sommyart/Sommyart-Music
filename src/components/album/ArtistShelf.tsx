import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { useArtists } from "@/hooks/useAlbums";

/** Horizontal artist shelf for the home screen. */
export function ArtistShelf() {
  const { artists, loading } = useArtists();
  const navigate = useNavigate();

  if (loading || artists.length === 0) return null;

  return (
    <section className="px-4 mb-6">
      <div className="flex items-center gap-2 mb-3 px-2">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-display tracking-widest text-primary">ARTISTS</h2>
      </div>
      <div className="flex gap-5 overflow-x-auto pb-2 px-2">
        {artists.map((artist) => (
          <button
            key={artist.id}
            onClick={() => navigate(`/artist/${artist.id}`)}
            className="w-24 shrink-0 text-center"
          >
            <div className="w-24 h-24 rounded-full overflow-hidden neon-border mb-2">
              <img
                src={artist.imageUrl}
                alt={artist.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[11px] font-medium text-foreground leading-tight">{artist.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
