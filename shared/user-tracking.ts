export const USER_TRACKING_EVENTS = [
  "session_started",
  "signed_in",
  "signed_up",
  "project_created",
  "task_completed",
  "task_uncompleted",
  "project_deleted",
  "calendar_exported",
] as const;

export type UserTrackingEvent = (typeof USER_TRACKING_EVENTS)[number];

export type UserPlatform = "web" | "mac" | "ios" | "android" | "unknown";

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
  lastPlatform: UserPlatform;
  appVersion: string;
}

export interface UserEventRecord {
  id: string;
  userId: string;
  event: UserTrackingEvent;
  properties: Record<string, unknown>;
  platform: UserPlatform;
  createdAt: string;
}

export function isUserTrackingEvent(value: string): value is UserTrackingEvent {
  return (USER_TRACKING_EVENTS as readonly string[]).includes(value);
}
