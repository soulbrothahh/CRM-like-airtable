"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isCloudEnabled } from "@/lib/supabase";

interface AuthContextValue {
  cloudEnabled: boolean;
  ready: boolean; // initial session check complete
  session: Session | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; info?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isCloudEnabled);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return; // on-device mode: no auth
    let active = true;

    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Cloud is not configured." };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Cloud is not configured." };
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) {
      return { info: "Account created. Check your email to confirm, then sign in." };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      cloudEnabled: isCloudEnabled,
      ready,
      session,
      email: session?.user?.email ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [ready, session, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
