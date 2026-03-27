import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const SignupScreen = () => {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async () => {
    setError("");
    if (!username.trim() || username.trim().length < 3) { setError("Username must be at least 3 characters"); return; }
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be 4 digits"); return; }
    if (pin !== confirmPin) { setError("PINs don't match"); return; }
    setLoading(true);
    const result = await signup(username.trim(), pin);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/5 via-transparent to-neon-cyan/5 pointer-events-none" />

      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden neon-glow animate-float">
            <img src="/images/logo.png" alt="Sommyart" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-wider neon-text text-foreground">
            Create Account
          </h1>
          <p className="text-sm text-muted-foreground">Join Sommyart Music</p>
        </div>

        <div className="space-y-4">
          <div className="glass neon-border rounded-xl p-1">
            <input
              type="text"
              placeholder="Choose a username"
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
              placeholder="Create 4-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none font-body tracking-[0.5em] text-center text-lg"
            />
          </div>

          <div className="glass neon-border rounded-xl p-1">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none font-body tracking-[0.5em] text-center text-lg"
            />
          </div>

          {error && <p className="text-destructive text-sm text-center">{error}</p>}

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold tracking-wider neon-glow hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {loading ? "Creating..." : "SIGN UP"}
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")} className="text-primary hover:underline">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignupScreen;
