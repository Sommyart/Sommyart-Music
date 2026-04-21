import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { DownloadProvider } from "@/contexts/DownloadContext";
import { FavouritesProvider } from "@/contexts/FavouritesContext";
import { BottomNav } from "@/components/layout/BottomNav";
import { MiniPlayer } from "@/components/layout/MiniPlayer";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import { useDailyNotification } from "@/hooks/useDailyNotification";
import { useNewTrackNotifier } from "@/hooks/useNewTrackNotifier";
import { useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import PlayerScreen from "./pages/PlayerScreen";
import PlaylistScreen from "./pages/PlaylistScreen";
import DownloadsScreen from "./pages/DownloadsScreen";
import NotFound from "./pages/NotFound";
import InstallPrompt from "./components/InstallPrompt";
import { UsernameGate } from "./components/UsernameGate";

const queryClient = new QueryClient();

function AppShell() {
  const { currentTrack, isPlaying, togglePlay, handleNext, handlePrev, mainTracks, songsLoading, playTrack, playlist } = useMusicPlayerContext();
  const navigate = useNavigate();
  useDailyNotification();
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
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/player" element={<PlayerScreen />} />
        <Route path="/playlist" element={<PlaylistScreen />} />
        <Route path="/downloads" element={<DownloadsScreen />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
              <InstallPrompt />
              <UsernameGate />
              <AppShell />
            </FavouritesProvider>
          </DownloadProvider>
        </MusicPlayerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
