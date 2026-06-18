import { DEFAULT_CALENDAR_TIMEZONE } from "./calendar";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayAvailability {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface NotificationSchedule {
  timezone: string;
  days: Record<Weekday, DayAvailability>;
}

const WEEKDAY_FROM_JS: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultWeekday(enabled: boolean, startHour: number, endHour: number): DayAvailability {
  return { enabled, startHour, endHour };
}

export function defaultNotificationSchedule(
  timezone = DEFAULT_CALENDAR_TIMEZONE
): NotificationSchedule {
  return {
    timezone,
    days: {
      Mon: defaultWeekday(true, 9, 18),
      Tue: defaultWeekday(true, 9, 18),
      Wed: defaultWeekday(true, 9, 18),
      Thu: defaultWeekday(true, 9, 18),
      Fri: defaultWeekday(true, 9, 18),
      Sat: defaultWeekday(false, 10, 14),
      Sun: defaultWeekday(false, 10, 14),
    },
  };
}

function clampHour(value: unknown, fallback: number): number {
  const hour = Number(value);
  if (!Number.isFinite(hour)) return fallback;
  return Math.min(23, Math.max(0, Math.round(hour)));
}

function parseDayAvailability(
  value: unknown,
  fallback: DayAvailability
): DayAvailability {
  if (!value || typeof value !== "object") return { ...fallback };
  const row = value as Record<string, unknown>;
  const startHour = clampHour(row.startHour, fallback.startHour);
  let endHour = clampHour(row.endHour, fallback.endHour);
  if (endHour <= startHour) {
    endHour = Math.min(24, startHour + 1);
  }
  return {
    enabled: row.enabled === undefined ? fallback.enabled : Boolean(row.enabled),
    startHour,
    endHour,
  };
}

export function parseNotificationSchedule(value: unknown): NotificationSchedule | null {
  if (value == null || value === "") return null;

  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const fallback = defaultNotificationSchedule();
  const timezone =
    typeof record.timezone === "string" && record.timezone.trim()
      ? record.timezone.trim()
      : fallback.timezone;

  const daysInput =
    record.days && typeof record.days === "object"
      ? (record.days as Record<string, unknown>)
      : {};

  const days = {} as Record<Weekday, DayAvailability>;
  for (const day of WEEKDAYS) {
    days[day] = parseDayAvailability(daysInput[day], fallback.days[day]);
  }

  return { timezone, days };
}

export function resolveNotificationSchedule(
  value: unknown,
  timezone = DEFAULT_CALENDAR_TIMEZONE
): NotificationSchedule {
  return parseNotificationSchedule(value) ?? defaultNotificationSchedule(timezone);
}

export function weekdayFromDate(date: Date): Weekday {
  return WEEKDAY_FROM_JS[date.getDay()];
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function isInWindow(date: Date, day: DayAvailability): boolean {
  if (!day.enabled) return false;
  const minutes = minutesSinceMidnight(date);
  return minutes >= day.startHour * 60 && minutes < day.endHour * 60;
}

function atWindowStart(date: Date, day: DayAvailability): Date {
  const next = new Date(date);
  next.setHours(day.startHour, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** First available push moment on or after `from`, searching up to 14 days. */
function nextAvailableMoment(from: Date, schedule: NotificationSchedule): Date | null {
  const startDay = startOfDay(from);

  for (let offset = 0; offset < 14; offset += 1) {
    const dayDate = addDays(startDay, offset);
    const day = schedule.days[weekdayFromDate(dayDate)];
    if (!day.enabled) continue;

    const windowStart = atWindowStart(dayDate, day);
    const windowEnd = new Date(dayDate);
    windowEnd.setHours(day.endHour, 0, 0, 0);

    if (offset === 0) {
      if (from >= windowEnd) continue;
      if (from <= windowStart) return windowStart;
      if (isInWindow(from, day)) return from;
      continue;
    }

    return windowStart;
  }

  return null;
}

/**
 * Shift a push time into the user's availability windows.
 * Never schedules after the related event start.
 */
export function adjustPushTime(
  idealPushAt: Date,
  eventStart: Date,
  schedule: NotificationSchedule
): Date {
  if (idealPushAt >= eventStart) {
    return new Date(eventStart.getTime() - 60_000);
  }

  if (isInWindow(idealPushAt, schedule.days[weekdayFromDate(idealPushAt)])) {
    return idealPushAt;
  }

  const day = schedule.days[weekdayFromDate(idealPushAt)];
  if (day.enabled) {
    const windowStart = atWindowStart(idealPushAt, day);
    if (idealPushAt < windowStart && windowStart < eventStart) {
      return windowStart;
    }
  }

  const shifted = nextAvailableMoment(idealPushAt, schedule);
  if (!shifted || shifted >= eventStart) {
    const fallback = atWindowStart(idealPushAt, schedule.days[weekdayFromDate(eventStart)]);
    if (fallback < eventStart && schedule.days[weekdayFromDate(eventStart)].enabled) {
      return fallback;
    }
    return new Date(eventStart.getTime() - 60_000);
  }

  return shifted;
}

export function taskStartHourForDay(
  day: string,
  schedule: NotificationSchedule | undefined,
  fallbackHour = 9
): number {
  if (!schedule) return fallbackHour;
  const availability = schedule.days[day as Weekday];
  if (!availability?.enabled) return fallbackHour;
  return availability.startHour;
}
