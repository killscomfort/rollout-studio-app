import { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, requireUserId } from "./supabase";

let channel: RealtimeChannel | null = null;
let listeners = new Set<() => void>();

export function subscribeToCloudChanges(onChange: () => void) {
  listeners.add(onChange);

  if (channel) {
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) {
        void getSupabase().removeChannel(channel!);
        channel = null;
      }
    };
  }

  void requireUserId()
    .then((userId) => {
      const supabase = getSupabase();
      channel = supabase
        .channel(`rollout-studio-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "projects",
            filter: `user_id=eq.${userId}`,
          },
          () => listeners.forEach((listener) => listener())
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "task_progress",
            filter: `user_id=eq.${userId}`,
          },
          () => listeners.forEach((listener) => listener())
        )
        .subscribe();
    })
    .catch(() => {
      // Not signed in yet.
    });

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && channel) {
      void getSupabase().removeChannel(channel);
      channel = null;
    }
  };
}
