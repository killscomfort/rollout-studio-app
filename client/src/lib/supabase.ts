import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./config";

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
  }

  return client;
}

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

export async function requireUserId() {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) {
    throw new Error("Not signed in");
  }
  return data.user.id;
}
