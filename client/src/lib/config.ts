const PLACEHOLDER_VALUES = new Set([
  "your-anon-key",
  "https://your-project.supabase.co",
]);

function isConfiguredValue(value: string | undefined) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_VALUES.has(trimmed) && !trimmed.includes("your-project");
}

export function isSupabaseConfigured() {
  return (
    isConfiguredValue(import.meta.env.VITE_SUPABASE_URL) &&
    isConfiguredValue(import.meta.env.VITE_SUPABASE_ANON_KEY)
  );
}

function rolloutBackendMode() {
  return import.meta.env.VITE_ROLLOUT_BACKEND?.trim();
}

/** Cloud mode was requested at build time (e.g. Vercel uses build:vercel). */
export function isCloudBackendRequested() {
  return rolloutBackendMode() === "cloud";
}

/** Cloud deployment is missing Supabase keys baked into the client bundle. */
export function isCloudBackendMisconfigured() {
  return isCloudBackendRequested() && !isSupabaseConfigured();
}

/** Whether project data should come from Supabase (vs local SQLite / native store). */
export function useCloudBackend() {
  const mode = rolloutBackendMode();
  if (mode === "local") return false;
  if (mode === "cloud") return isSupabaseConfigured();

  // Local desktop builds embed the API URL.
  if (import.meta.env.VITE_API_BASE?.trim()) return false;

  return isSupabaseConfigured();
}
