"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Brand } from "./Nav";

// In cloud mode, blocks the app behind a login. In on-device mode, renders children.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { cloudEnabled, ready, session } = useAuth();

  if (!cloudEnabled) return <>{children}</>;
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-taupe-400">
        Loading…
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const res =
        mode === "signin"
          ? await signIn(email.trim(), password)
          : await signUp(email.trim(), password);
      if (res.error) setError(res.error);
      const infoMsg = (res as { info?: string }).info;
      if (infoMsg) setInfo(infoMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <p className="-mt-2 mb-1 text-center text-[11px] font-semibold uppercase tracking-widest text-gold-600">
          Built for better moments
        </p>
        <h1 className="text-center text-lg font-bold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 mb-5 text-center text-sm text-taupe-500">
          {mode === "signin"
            ? "Sign in to your connections on any device."
            : "Set up your private workspace."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {info && <p className="text-sm text-sage-500">{info}</p>}

          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="mt-4 w-full text-center text-sm text-taupe-500 hover:text-gold-600"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
