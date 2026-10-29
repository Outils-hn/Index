import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
/**
 * Compte valide par un collegue ? Un compte non valide peut seulement lire (comme un visiteur).
 * Si la base n'a pas encore la validation (fonction absente), on garde l'ancien comportement :
 * tout compte connecte peut modifier. La vraie protection est cote base, ceci ne fait que l'affichage.
 */
export function useApproval(user: User | null) {
  const q = useQuery({
    queryKey: ["approved", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_approved");
      if (error) return /is_approved|function|schema cache/i.test(error.message) ? true : false;
      return data === true;
    },
  });
  return { approved: !!user && q.data === true, checking: !!user && q.isLoading };
}
