import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NOTIFY_MODE_EVENT } from "@/lib/notify";
import { forgetPushToken, listenForPush, PUSH_PERMISSION_EVENT, pushSupported, registerForPush, syncPushToken } from "@/lib/push";

/** Keeps this phone's push token on the server while someone is signed in (installed Android app only). */
export function usePushRegistration() {
  const navigate = useNavigate();

  useEffect(() => listenForPush((route) => navigate(route)), [navigate]);

  useEffect(() => {
    if (!pushSupported()) return;
    let signedIn = false;
    const start = () => { if (signedIn) registerForPush().then(syncPushToken); };

    supabase.auth.getSession().then(({ data }) => {
      signedIn = !!data.session;
      start();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      signedIn = !!session;
      if (event === "SIGNED_OUT") forgetPushToken();
      else if (event === "SIGNED_IN") start();
    });
    const onChange = () => { if (signedIn) syncPushToken(); };
    const onPermission = () => start();
    window.addEventListener(NOTIFY_MODE_EVENT, onChange);
    window.addEventListener(PUSH_PERMISSION_EVENT, onPermission);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener(NOTIFY_MODE_EVENT, onChange);
      window.removeEventListener(PUSH_PERMISSION_EVENT, onPermission);
    };
  }, []);
}
