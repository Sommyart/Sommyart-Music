import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MusicPlayerProvider } from "@/contexts/MusicPlayerContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BottomNav } from "@/components/layout/BottomNav";
import { MiniPlayer } from "@/components/layout/MiniPlayer";
import { useMusicPlayerContext } from "@/contexts/MusicPlayerContext";
import Index from "./pages/Index";
import PlayerScreen from "./pages/PlayerScreen";
import PlaylistScreen from "./pages/PlaylistScreen";
import DownloadsScreen from "./pages/DownloadsScreen";
import SplashScreen from "./pages/SplashScreen";
import LoginScreen from "./pages/LoginScreen";
import SignupScreen from "./pages/SignupScreen";
import ForgotPinScreen from "./pages/ForgotPinScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppShell() {
  const { currentTrack, isPlaying, togglePlay } = useMusicPlayerContext();
  return (
    <>
      <Routes>
        <Route path="/splash" element={<SplashScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/forgot-pin" element={<ForgotPinScreen />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/player" element={<ProtectedRoute><PlayerScreen /></ProtectedRoute>} />
        <Route path="/playlist" element={<ProtectedRoute><PlaylistScreen /></ProtectedRoute>} />
        <Route path="/downloads" element={<ProtectedRoute><DownloadsScreen /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <MiniPlayer track={currentTrack} isPlaying={isPlaying} onTogglePlay={togglePlay} />
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
        <AuthProvider>
          <MusicPlayerProvider>
            <AppShell />
          </MusicPlayerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
