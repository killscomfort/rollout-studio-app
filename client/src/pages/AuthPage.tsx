import { useState } from "react";
import * as supabaseStore from "../data/supabase-store";

interface AuthPageProps {
  onSignedIn: () => void;
}

export function AuthPage({ onSignedIn }: AuthPageProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "sign-in") {
        await supabaseStore.signIn(email.trim(), password);
        onSignedIn();
        return;
      }

      await supabaseStore.signUp(email.trim(), password);
      setMessage("Account created. If email confirmation is enabled, check your inbox, then sign in.");
      setMode("sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell auth-shell">
      <div className="panel-card auth-card">
        <h1 className="page-title">Rollout Studio</h1>
        <p className="page-subtitle">
          Sign in to sync rollout checklists across your Mac and iPhone.
        </p>

        <div className="top-nav">
          <button
            type="button"
            className={`button ${mode === "sign-in" ? "primary" : "ghost"}`}
            onClick={() => setMode("sign-in")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`button ${mode === "sign-up" ? "primary" : "ghost"}`}
            onClick={() => setMode("sign-up")}
          >
            Create account
          </button>
        </div>

        {error ? <div className="callout">{error}</div> : null}
        {message ? <div className="callout success">{message}</div> : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <div className="toolbar">
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
