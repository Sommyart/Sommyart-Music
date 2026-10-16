import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { takePendingDestination } from "@/lib/pendingDestination";

/**
 * After a shared link forces a sign-in/sign-up, return the user to the exact
 * song/album they opened. The destination lives in localStorage so it survives
 * reloads and OAuth redirects.
 */
export function PendingDestinationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const go = () => {
      const dest = takePendingDestination();
      if (dest) navigate(dest, { replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) go();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return null;
}
