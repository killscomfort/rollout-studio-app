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

/** Whether project data should come from Supabase (vs local SQLite / native store). */
export function useCloudBackend() {
  const mode = import.meta.env.VITE_ROLLOUT_BACKEND?.trim();
  if (mode === "local") return false;
  if (mode === "cloud") return true;

  // Local desktop builds embed the API URL.
  if (import.meta.env.VITE_API_BASE?.trim()) return false;

  return isSupabaseConfigured();
}
