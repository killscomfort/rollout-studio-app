import tsdav, { type DAVCalendar } from "tsdav";
import ical, { ICalAlarmType } from "ical-generator";
import type { NotificationTask } from "../../shared/calendar.ts";
import { CALENDAR_UID_PREFIX } from "../../shared/calendar.ts";

const { createDAVClient } = tsdav;

type Client = Awaited<ReturnType<typeof createDAVClient>>;

const ICLOUD_CALDAV = "https://caldav.icloud.com";

export async function connect(appleId: string, appPassword: string): Promise<Client> {
  return createDAVClient({
    serverUrl: ICLOUD_CALDAV,
    credentials: { username: appleId, password: appPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

function displayName(calendar: DAVCalendar): string {
  const name = calendar.displayName;
  return typeof name === "string" ? name : "";
}

export async function findCalendar(client: Client, name: string): Promise<DAVCalendar> {
  const calendars = await client.fetchCalendars();
  const match = calendars.find((calendar) => displayName(calendar) === name);
  if (!match) {
    const available = calendars.map(displayName).filter(Boolean).join(", ");
    throw new Error(
      `Calendar "${name}" not found in iCloud.\n` +
        `Available calendars: ${available}\n` +
        `→ Open Calendar.app and create a calendar named exactly "${name}", then re-run.`
    );
  }
  return match;
}

function buildICal(
  task: NotificationTask,
  calendarName: string,
  timezone: string
): string {
  const uid = `${CALENDAR_UID_PREFIX}${task.id}@rolloutstudio.app`;
  const cal = ical({
    name: calendarName,
    prodId: { company: "killscomfort", product: "rollout-studio", language: "EN" },
  });
  const description = task.notes + (task.link ? `\n\n${task.link}` : "");
  const event = cal.createEvent({
    id: uid,
    start: task.start,
    end: task.end,
    summary: task.title,
    description: description.trim(),
    timezone,
    url: task.link,
  });
  event.createAlarm({
    type: ICalAlarmType.display,
    triggerBefore: Math.max(0, task.alertMinutes) * 60,
  });
  return cal.toString();
}

function extractUid(ics: string): string | null {
  const match = ics.match(/^UID:(.+)$/m);
  return match ? match[1].trim() : null;
}

export interface UpsertResult {
  id: string;
  action: "created" | "updated";
}

export async function upsertEvents(
  client: Client,
  calendar: DAVCalendar,
  tasks: NotificationTask[],
  calendarName: string,
  timezone: string
): Promise<UpsertResult[]> {
  const existing = await client.fetchCalendarObjects({ calendar });
  const byUid = new Map<string, { url: string; etag?: string }>();
  for (const obj of existing) {
    const uid = extractUid(obj.data || "");
    if (uid) byUid.set(uid, { url: obj.url, etag: obj.etag });
  }

  const results: UpsertResult[] = [];
  for (const task of tasks) {
    const uid = `${CALENDAR_UID_PREFIX}${task.id}@rolloutstudio.app`;
    const iCalString = buildICal(task, calendarName, timezone);
    const found = byUid.get(uid);

    if (found) {
      await client.updateCalendarObject({
        calendarObject: { url: found.url, data: iCalString, etag: found.etag },
      });
      results.push({ id: task.id, action: "updated" });
    } else {
      await client.createCalendarObject({
        calendar,
        filename: `${uid}.ics`,
        iCalString,
      });
      results.push({ id: task.id, action: "created" });
    }
  }
  return results;
}
