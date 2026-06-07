import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const setAuthState = (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setAuthState(s);
      if (initialized && mounted) setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      initialized = true;
      setAuthState(data.session);
      if (mounted) setLoading(false);
    }).catch(() => {
      initialized = true;
      setAuthState(null);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading };
}