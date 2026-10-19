import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useRef } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { DownloadProvider } from "@/contexts/DownloadContext";
import { FavouritesProvider } from "@/contexts/FavouritesContext";
import { FollowsProvider } from "@/contexts/FollowsContext";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { useNewSongAlerts } from "@/hooks/useNewSongAlerts";
import { BottomNav } from "@/components/layout/BottomNav";
import { MiniPlayer } from "@/components/layout/MiniPlayer";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { useDailyNotification } from "@/hooks/useDailyNotification";
import { useNewTrackNotifier } from "@/hooks/useNewTrackNotifier";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useSwipeTabs, TAB_PATHS } from "@/hooks/useSwipeTabs";
import { UpdatePrompt } from "@/components/UpdatePrompt";


import { useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import PlayerScreen from "./pages/PlayerScreen";
import PlaylistScreen from "./pages/PlaylistScreen";
import DownloadsScreen from "./pages/DownloadsScreen";
import AlbumsScreen from "./pages/AlbumsScreen";
import AlbumDetail from "./pages/AlbumDetail";
import ArtistDetail from "./pages/ArtistDetail";
import AdminLyrics from "./pages/AdminLyrics";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";
import InstallPrompt from "./components/InstallPrompt";
import { AuthGate } from "./components/AuthGate";
import SongDetail from "./pages/SongDetail";
import MyPlaylists from "./pages/MyPlaylists";
import MyPlaylistDetail from "./pages/MyPlaylistDetail";
import { PlaylistPickerProvider } from "@/contexts/PlaylistPickerContext";
import { PendingDestinationHandler } from "./components/PendingDestinationHandler";


const queryClient = new QueryClient();

function AppShell() {
  const { currentTrack, isPlaying, togglePlay, handleNext, handlePrev, mainTracks, songsLoading, playTrack, playlist } = useMusicPlayerContext();
  const navigate = useNavigate();
  useDailyNotification();
  useNewSongAlerts();
  useMediaSession();
  useSwipeTabs();
  const { pathname } = useLocation();
  // Slide the page in from the side the user is moving toward.
  const prevIndex = useRef(TAB_PATHS.indexOf(pathname));
  const index = TAB_PATHS.indexOf(pathname);
  const slide =
    index >= 0 && prevIndex.current >= 0 && index !== prevIndex.current
      ? index > prevIndex.current
        ? "animate-in fade-in slide-in-from-right-8 duration-300"
        : "animate-in fade-in slide-in-from-left-8 duration-300"
      : "";
  prevIndex.current = index;
  useNewTrackNotifier(mainTracks, songsLoading, () => {

    // Find and play the newest dated track
    const dated = mainTracks
      .filter((t) => t.uploadedAt)
      .sort((a, b) => new Date(b.uploadedAt!).getTime() - new Date(a.uploadedAt!).getTime());
    const newest = dated[0];
    if (newest) {
      const idx = playlist.findIndex((t) => t.id === newest.id);
      if (idx >= 0) {
        playTrack(idx);
        navigate("/player");
      }
    }
  });
  return (
    <>
      <div key={pathname} className={slide}>
      <Routes>

        <Route path="/" element={<Index />} />
        <Route path="/player" element={<PlayerScreen />} />
        <Route path="/playlist" element={<PlaylistScreen />} />
        <Route path="/downloads" element={<DownloadsScreen />} />
        <Route path="/playlists" element={<MyPlaylists />} />
        <Route path="/playlists/:id" element={<MyPlaylistDetail />} />
        <Route path="/albums" element={<AlbumsScreen />} />
        <Route path="/album/:id" element={<AlbumDetail />} />
        <Route path="/song/:id" element={<SongDetail />} />
        <Route path="/artist/:id" element={<ArtistDetail />} />
        <Route path="/admin/lyrics" element={<AdminLyrics />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </div>

      <PendingDestinationHandler />
      <MiniPlayer track={currentTrack} isPlaying={isPlaying} onTogglePlay={togglePlay} onNext={handleNext} onPrev={handlePrev} />
      <BottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MusicPlayerProvider>
          <DownloadProvider>
            <FavouritesProvider>
              <FollowsProvider>
              <InstallPrompt />
              <UpdatePrompt />
              <NotificationPrompt />
              <AuthGate />
              <PlaylistPickerProvider>
                <AppShell />
              </PlaylistPickerProvider>
              </FollowsProvider>
            </FavouritesProvider>
          </DownloadProvider>
        </MusicPlayerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
