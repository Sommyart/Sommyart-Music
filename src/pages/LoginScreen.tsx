import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const LoginScreen = () => {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    if (!username.trim()) { setError("Enter your username"); return; }
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be 4 digits"); return; }
    setLoading(true);
    const result = await login(username.trim(), pin);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />

      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden neon-glow animate-float">
            <img src="/images/logo.png" alt="Sommyart" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-wider neon-text text-foreground">
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to Sommyart Music</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="glass neon-border rounded-xl p-1">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none font-body"
              autoCapitalize="none"
            />
          </div>

          <div className="glass neon-border rounded-xl p-1">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none font-body tracking-[0.5em] text-center text-lg"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold tracking-wider neon-glow hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {loading ? "Signing in..." : "SIGN IN"}
          </button>
        </div>

        {/* Links */}
        <div className="flex flex-col items-center gap-3 text-sm">
          <button onClick={() => navigate("/forgot-pin")} className="text-primary hover:underline">
            Forgot PIN?
          </button>
          <p className="text-muted-foreground">
            Don't have an account?{" "}
            <button onClick={() => navigate("/signup")} className="text-primary hover:underline">
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
