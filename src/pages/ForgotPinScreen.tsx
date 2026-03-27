import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ForgotPinScreen = () => {
  const [username, setUsername] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async () => {
    setError("");
    if (!username.trim()) { setError("Enter your username"); return; }
    if (!/^\d{4}$/.test(newPin)) { setError("PIN must be 4 digits"); return; }
    if (newPin !== confirmPin) { setError("PINs don't match"); return; }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("auth-pin", {
        body: { action: "reset_pin", username: username.trim(), pin: "0000", newPin },
      });
      if (fnError || data?.error) {
        setError(data?.error || fnError?.message || "Reset failed");
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
        <div className="relative text-center space-y-6">
          <div className="w-20 h-20 rounded-full glass neon-border flex items-center justify-center mx-auto neon-glow">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-xl font-display font-bold neon-text text-foreground">PIN Reset!</h2>
          <p className="text-muted-foreground text-sm">You can now sign in with your new PIN.</p>
          <button
            onClick={() => navigate("/login")}
            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold tracking-wider neon-glow"
          >
            SIGN IN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />

      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-display font-bold tracking-wider neon-text text-foreground">
            Reset PIN
          </h1>
          <p className="text-sm text-muted-foreground text-center">Enter your username and create a new 4-digit PIN</p>
        </div>

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
              placeholder="New 4-digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
            onClick={handleReset}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold tracking-wider neon-glow hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {loading ? "Resetting..." : "RESET PIN"}
          </button>
        </div>

        <button onClick={() => navigate("/login")} className="block mx-auto text-sm text-primary hover:underline">
          Back to Sign In
        </button>
      </div>
    </div>
  );
};

export default ForgotPinScreen;
