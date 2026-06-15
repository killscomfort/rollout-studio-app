import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import {
  DEFAULT_CALENDAR_NAME,
  DEFAULT_CALENDAR_TIMEZONE,
} from "../../shared/calendar.ts";

loadEnv({ path: resolve(process.cwd(), ".env") });

function req(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export const notificationConfig = {
  appleId: process.env.ICLOUD_APPLE_ID?.trim() || "",
  appPassword: process.env.ICLOUD_APP_PASSWORD?.trim() || "",
  calendarName: process.env.ROLLOUT_CALENDAR_NAME?.trim() || DEFAULT_CALENDAR_NAME,
  timezone: process.env.ROLLOUT_TIMEZONE?.trim() || DEFAULT_CALENDAR_TIMEZONE,
  pushcutApiKey: process.env.PUSHCUT_API_KEY?.trim() || "",
  pushcutNotification:
    process.env.PUSHCUT_NOTIFICATION_NAME?.trim() || "RolloutNudge",
  projectRef: process.env.ROLLOUT_PROJECT_ID?.trim() || "",
  pushByDefault: process.env.ROLLOUT_PUSH_BY_DEFAULT === "1",
  pushLeadMinutes: Number(process.env.ROLLOUT_PUSH_LEAD_MINUTES ?? 15),
  alertMinutes: Number(process.env.ROLLOUT_ALERT_MINUTES ?? 30),
};

export function hasIcloudCredentials() {
  return Boolean(notificationConfig.appleId && notificationConfig.appPassword);
}

export function requireIcloudCredentials() {
  return {
    appleId: req("ICLOUD_APPLE_ID"),
    appPassword: req("ICLOUD_APP_PASSWORD"),
  };
}
