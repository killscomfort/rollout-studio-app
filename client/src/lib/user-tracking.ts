import { Capacitor } from "@capacitor/core";
import type { UserPlatform, UserTrackingEvent } from "../../../shared/user-tracking";
import { getSupabase } from "./supabase";

const APP_VERSION = import.meta.env.VITE_APP_VERSION?.trim() || "0.1.0";

export function detectUserPlatform(): UserPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  if (platform === "web") {
    return navigator.userAgent.includes("Electron") ? "mac" : "web";
  }
  return "unknown";
}

async function currentUser() {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

export async function upsertUserPresence() {
  const user = await currentUser();
  if (!user) return;

  const platform = detectUserPlatform();
  const now = new Date().toISOString();

  await getSupabase().from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      last_seen_at: now,
      last_platform: platform,
      app_version: APP_VERSION,
    },
    { onConflict: "id" }
  );
}

export async function recordUserEvent(
  event: UserTrackingEvent,
  properties: Record<string, unknown> = {}
) {
  const user = await currentUser();
  if (!user) return;

  const platform = detectUserPlatform();

  await getSupabase().from("user_events").insert({
    user_id: user.id,
    event,
    properties,
    platform,
  });
}

export async function trackUserActivity(
  event: UserTrackingEvent,
  properties: Record<string, unknown> = {}
) {
  try {
    await upsertUserPresence();
    await recordUserEvent(event, properties);
  } catch {
    // Tracking must never block app flows.
  }
}
