import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SplashScreen = () => {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFadeOut(true), 2200);
    const timer2 = setTimeout(() => navigate("/login", { replace: true }), 2800);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [navigate]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center relative transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
      <div className="absolute w-64 h-64 rounded-full bg-neon-cyan/10 blur-3xl animate-pulse-neon" />
      <div className="absolute w-48 h-48 rounded-full bg-neon-purple/10 blur-2xl animate-pulse-neon [animation-delay:1s]" />
      
      <div className="relative animate-float">
        <div className="w-32 h-32 rounded-3xl overflow-hidden neon-glow">
          <img src="/images/logo.png" alt="Sommyart Music" className="w-full h-full object-cover" />
        </div>
      </div>
      
      <h1 className="relative mt-8 text-3xl font-display font-bold tracking-widest neon-text text-foreground">
        SOMMYART
      </h1>
      <p className="relative mt-2 text-sm text-muted-foreground tracking-[0.3em] font-display">
        MUSIC
      </p>
    </div>
  );
};

export default SplashScreen;
