import { SkyBackground } from "../components/SkyBackground";

export function CloudSetupPage() {
  return (
    <div className="app-shell auth-shell">
      <SkyBackground layout="fixed" />
      <div className="panel-card auth-card">
        <h1 className="page-title">Rollout Studio</h1>
        <p className="page-subtitle">
          This deployment is missing Supabase credentials in the build.
        </p>
        <div className="callout">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the
          Vercel project environment variables, then trigger a new deployment.
        </div>
        <p className="page-subtitle" style={{ marginTop: 16 }}>
          Copy both values from Supabase → Settings → API. Use the anon / publishable key, not
          the service role key.
        </p>
      </div>
    </div>
  );
}
