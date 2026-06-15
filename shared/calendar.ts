import type { ProjectDetail } from "./types";
import { CATEGORY_LABELS } from "./types";

const DAY_OFFSET: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export interface CalendarEvent {
  taskId: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  weekLabel: string;
  phaseTitle: string;
  link?: string;
}

export interface CalendarOptions {
  releaseDate: string;
  reminderMinutesBefore?: number;
  hour?: number;
  minute?: number;
  durationMinutes?: number;
  timezone?: string;
  calendarName?: string;
  skipCompleted?: boolean;
}

export const CALENDAR_UID_PREFIX = "kc-rollout-";
export const DEFAULT_CALENDAR_ALERT_MINUTES = 30;
export const DEFAULT_CALENDAR_DURATION_MINUTES = 30;
export const DEFAULT_CALENDAR_TIMEZONE = "America/New_York";
export const DEFAULT_CALENDAR_NAME = "KillsComfort Rollout";

export function countPlanWeeks(project: ProjectDetail): number {
  return project.phases.reduce((sum, phase) => sum + phase.weeks.length, 0);
}

function startOfWeekMonday(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function suggestReleaseDate(totalWeeks: number, from = new Date()): string {
  if (totalWeeks < 1) {
    return formatDateOnly(from);
  }

  const monday = startOfWeekMonday(from);
  const releaseFriday = addDays(monday, (totalWeeks - 1) * 7 + 4);
  return formatDateOnly(releaseFriday);
}

export function buildCalendarEvents(
  project: ProjectDetail,
  options: CalendarOptions
): CalendarEvent[] {
  const totalWeeks = countPlanWeeks(project);
  if (totalWeeks === 0) return [];

  const releaseWeekMonday = startOfWeekMonday(parseDateOnly(options.releaseDate));
  const hour = options.hour ?? 9;
  const minute = options.minute ?? 0;
  const durationMinutes = options.durationMinutes ?? DEFAULT_CALENDAR_DURATION_MINUTES;
  const skipCompleted = options.skipCompleted ?? true;
  const link = project.bookingUrl?.trim() || undefined;
  const events: CalendarEvent[] = [];
  let globalWeekIndex = 0;

  for (const phase of [...project.phases].sort(
    (left, right) => left.sortOrder - right.sortOrder
  )) {
    for (const week of [...phase.weeks].sort(
      (left, right) => left.sortOrder - right.sortOrder
    )) {
      const weekMonday = addDays(
        releaseWeekMonday,
        -(totalWeeks - 1 - globalWeekIndex) * 7
      );

      for (const task of [...week.tasks].sort(
        (left, right) => left.sortOrder - right.sortOrder
      )) {
        if (skipCompleted && task.completed) continue;

        const dayOffset = DAY_OFFSET[task.day] ?? 0;
        const dayDate = addDays(weekMonday, dayOffset);
        const start = new Date(dayDate);
        start.setHours(hour, minute, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + durationMinutes);

        const description = [
          `${project.name}`,
          `${phase.title} · ${week.label} · ${task.day}`,
          "",
          task.task,
          link ? `\n${link}` : "",
        ]
          .join("\n")
          .trim();

        events.push({
          taskId: task.id,
          start,
          end,
          summary: `[${CATEGORY_LABELS[task.category]}] ${task.task}`,
          description,
          weekLabel: week.label,
          phaseTitle: phase.title,
          link,
        });
      }

      globalWeekIndex += 1;
    }
  }

  return events.sort((left, right) => left.start.getTime() - right.start.getTime());
}

function icsDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function icsStamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string): string {
  const max = 75;
  if (line.length <= max) return line;

  let result = line.slice(0, max);
  let rest = line.slice(max);
  while (rest.length > 0) {
    result += `\r\n ${rest.slice(0, max - 1)}`;
    rest = rest.slice(max - 1);
  }
  return result;
}

export function generateIcs(
  project: ProjectDetail,
  events: CalendarEvent[],
  options: {
    reminderMinutesBefore?: number;
    calendarName?: string;
    timezone?: string;
  } = {}
): string {
  const reminder = options.reminderMinutesBefore ?? DEFAULT_CALENDAR_ALERT_MINUTES;
  const calendarName = options.calendarName ?? `${project.name} Rollout`;
  const timezone = options.timezone ?? DEFAULT_CALENDAR_TIMEZONE;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rollout Studio//Rollout Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    `X-WR-TIMEZONE:${timezone}`,
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${CALENDAR_UID_PREFIX}${event.taskId}@rolloutstudio.app`,
      `DTSTAMP:${icsStamp()}`,
      `DTSTART:${icsDateTimeLocal(event.start)}`,
      `DTEND:${icsDateTimeLocal(event.end)}`,
      `SUMMARY:${escapeIcs(event.summary)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`
    );
    if (event.link) {
      lines.push(`URL:${escapeIcs(event.link)}`);
    }
    lines.push(
      "BEGIN:VALARM",
      `TRIGGER:-PT${reminder}M`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(event.summary)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function buildProjectIcs(
  project: ProjectDetail,
  options: CalendarOptions
): string {
  const events = buildCalendarEvents(project, options);
  return generateIcs(project, events, {
    reminderMinutesBefore: options.reminderMinutesBefore,
    calendarName: options.calendarName ?? `${project.name} Rollout`,
    timezone: options.timezone,
  });
}

/** Shape used by CalDAV / Pushcut sync scripts */
export interface NotificationTask {
  id: string;
  title: string;
  start: Date;
  end: Date;
  notes: string;
  link?: string;
  alertMinutes: number;
  push: boolean;
  pushAt?: Date;
}

export function toNotificationTasks(
  project: ProjectDetail,
  options: CalendarOptions & {
    push?: boolean;
    pushLeadMinutes?: number;
  }
): NotificationTask[] {
  const alertMinutes = options.reminderMinutesBefore ?? DEFAULT_CALENDAR_ALERT_MINUTES;
  const pushLead = options.pushLeadMinutes ?? 15;
  const pushDefault = options.push ?? false;

  return buildCalendarEvents(project, options).map((event) => {
    const push = pushDefault;
    return {
      id: event.taskId,
      title: event.summary,
      start: event.start,
      end: event.end,
      notes: event.description,
      link: event.link,
      alertMinutes,
      push,
      pushAt: push ? new Date(event.start.getTime() - pushLead * 60_000) : undefined,
    };
  });
}
