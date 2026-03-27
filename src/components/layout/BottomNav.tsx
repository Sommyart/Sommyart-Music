import { Home, ListMusic, Download, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: ListMusic, label: "Playlist", path: "/playlist" },
  { icon: Download, label: "Downloads", path: "/downloads" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on player screen
  if (location.pathname === "/player") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={20} className={active ? "neon-text" : ""} />
              <span className="text-[10px] font-display tracking-wider">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
