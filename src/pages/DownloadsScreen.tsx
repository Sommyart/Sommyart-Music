import { Download } from "lucide-react";

const DownloadsScreen = () => {
  return (
    <div className="min-h-screen pb-36">
      <div className="px-6 pt-12 pb-6">
        <h1 className="text-xl font-display font-bold tracking-wider text-foreground neon-text">Downloads</h1>
        <p className="text-xs text-muted-foreground mt-1">Your offline music</p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-20 h-20 rounded-full glass neon-border flex items-center justify-center mb-6">
          <Download size={32} className="text-primary" />
        </div>
        <p className="text-foreground font-display text-sm tracking-wide">No downloads yet</p>
        <p className="text-xs text-muted-foreground mt-2 max-w-[240px]">
          Download tracks from the playlist to listen offline
        </p>
      </div>
    </div>
  );
};

export default DownloadsScreen;
