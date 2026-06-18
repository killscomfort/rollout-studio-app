import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail } from "../../../shared/types";
import {
  buildCalendarEvents,
  buildProjectIcs,
  countPlanWeeks,
  DEFAULT_CALENDAR_ALERT_MINUTES,
  DEFAULT_CALENDAR_NAME,
  DEFAULT_CALENDAR_TIMEZONE,
  suggestReleaseDate,
  toNotificationTasks,
} from "../../../shared/calendar";
import {
  defaultNotificationSchedule,
  resolveNotificationSchedule,
  WEEKDAYS,
  type DayAvailability,
  type NotificationSchedule,
  type Weekday,
} from "../../../shared/notification-schedule";
import { api } from "../api";

interface CalendarSyncPanelProps {
  project: ProjectDetail;
  releaseDate: string;
  onReleaseDateChange: (value: string) => void;
  onProjectUpdated: (project: ProjectDetail) => void;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

function slugifyFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "rollout";
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized}:00 ${suffix}`;
}

async function shareCalendarFile(filename: string, ics: string) {
  const file = new File([ics], filename, {
    type: "text/calendar;charset=utf-8",
  });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Rollout calendar",
    });
    return;
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function updateDay(
  schedule: NotificationSchedule,
  day: Weekday,
  patch: Partial<DayAvailability>
): NotificationSchedule {
  return {
    ...schedule,
    days: {
      ...schedule.days,
      [day]: { ...schedule.days[day], ...patch },
    },
  };
}

export function CalendarSyncPanel({
  project,
  releaseDate,
  onReleaseDateChange,
  onProjectUpdated,
}: CalendarSyncPanelProps) {
  const isNative = Capacitor.isNativePlatform();
  const [reminderMinutes, setReminderMinutes] = useState(DEFAULT_CALENDAR_ALERT_MINUTES);
  const [schedule, setSchedule] = useState<NotificationSchedule>(() =>
    resolveNotificationSchedule(project.notificationSchedule, DEFAULT_CALENDAR_TIMEZONE)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSchedule(
      resolveNotificationSchedule(
        project.notificationSchedule,
        project.notificationSchedule?.timezone ?? DEFAULT_CALENDAR_TIMEZONE
      )
    );
  }, [project.id, project.notificationSchedule]);

  const totalWeeks = useMemo(() => countPlanWeeks(project), [project]);
  const suggestedDate = useMemo(
    () => suggestReleaseDate(totalWeeks),
    [totalWeeks]
  );

  const preview = useMemo(() => {
    if (!releaseDate) return null;
    return buildCalendarEvents(project, {
      releaseDate,
      reminderMinutesBefore: reminderMinutes,
      timezone: schedule.timezone,
      calendarName: `${project.name} Rollout`,
      skipCompleted: true,
      notificationSchedule: schedule,
    });
  }, [project, releaseDate, reminderMinutes, schedule]);

  const pushPreview = useMemo(() => {
    if (!releaseDate) return null;
    return toNotificationTasks(project, {
      releaseDate,
      reminderMinutesBefore: reminderMinutes,
      timezone: schedule.timezone,
      skipCompleted: true,
      push: true,
      pushLeadMinutes: 15,
      notificationSchedule: schedule,
    }).filter((task) => task.pushAt);
  }, [project, releaseDate, reminderMinutes, schedule]);

  async function saveNotificationSettings() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateProject(project.id, {
        notificationSchedule: schedule,
      });
      if (!updated) {
        throw new Error("Project not found");
      }
      onProjectUpdated(updated);
      setMessage("Notification schedule saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notification schedule");
    } finally {
      setBusy(false);
    }
  }

  async function saveReleaseDate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateProject(project.id, {
        releaseDate: releaseDate || null,
      });
      if (!updated) {
        throw new Error("Project not found");
      }
      onProjectUpdated(updated);
      setMessage("Release date saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save release date");
    } finally {
      setBusy(false);
    }
  }

  async function exportToCalendar() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const date = releaseDate || suggestedDate;
      if (!releaseDate) {
        const updated = await api.updateProject(project.id, { releaseDate: date });
        if (updated) {
          onReleaseDateChange(date);
          onProjectUpdated(updated);
        }
      }

      const events = buildCalendarEvents(project, {
        releaseDate: date,
        reminderMinutesBefore: reminderMinutes,
        timezone: schedule.timezone,
        calendarName: `${project.name} Rollout`,
        skipCompleted: true,
        notificationSchedule: schedule,
      });

      if (events.length === 0) {
        throw new Error("No upcoming tasks to add. Set a release date or uncheck completed tasks.");
      }

      const ics = buildProjectIcs(project, {
        releaseDate: date,
        reminderMinutesBefore: reminderMinutes,
        timezone: schedule.timezone,
        calendarName: `${project.name} Rollout`,
        skipCompleted: true,
        notificationSchedule: schedule,
      });

      await shareCalendarFile(`${slugifyFilename(project.name)}-rollout.ics`, ics);
      setMessage(
        isNative
          ? `Shared ${events.length} calendar events. Choose a calendar in the share sheet — iPhone will notify you from Calendar alerts.`
          : `Downloaded ${events.length} calendar events. Open the .ics file on your iPhone or Mac to add them to Apple Calendar.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar export failed");
    } finally {
      setBusy(false);
    }
  }

  function resetSchedule() {
    setSchedule(defaultNotificationSchedule(schedule.timezone));
  }

  return (
    <div className="panel-card calendar-panel">
      <h2 className="section-title">Apple Calendar reminders</h2>
      <p className="sync-copy">
        Turn rollout tasks into calendar events with native iPhone alerts. Set your weekly
        availability so Pushcut nudges land during hours you are actually reachable.
      </p>

      {message ? <div className="callout success">{message}</div> : null}
      {error ? <div className="callout">{error}</div> : null}

      <div className="form-grid">
        <label>
          Release date
          <input
            type="date"
            value={releaseDate}
            onChange={(event) => onReleaseDateChange(event.target.value)}
          />
        </label>
        <label>
          Alert before task
          <select
            value={reminderMinutes}
            onChange={(event) => setReminderMinutes(Number(event.target.value))}
          >
            <option value={0}>At task time</option>
            <option value={15}>15 minutes before</option>
            <option value={30}>30 minutes before</option>
            <option value={60}>1 hour before</option>
            <option value={120}>2 hours before</option>
            <option value={1440}>1 day before</option>
          </select>
        </label>
        <label>
          Timezone
          <select
            value={schedule.timezone}
            onChange={(event) =>
              setSchedule((current) => ({ ...current, timezone: event.target.value }))
            }
          >
            <option value="America/New_York">America/New_York</option>
            <option value="America/Chicago">America/Chicago</option>
            <option value="America/Denver">America/Denver</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
      </div>

      <div className="schedule-panel">
        <div className="schedule-panel-header">
          <h3 className="schedule-title">Your weekly availability</h3>
          <p className="schedule-copy">
            Tasks schedule at each day&apos;s start hour. Push nudges avoid off-hours and
            shift to your next available window.
          </p>
        </div>

        <div className="schedule-grid" role="group" aria-label="Weekly availability">
          <div className="schedule-row schedule-row-head">
            <span>Day</span>
            <span>Available</span>
            <span>From</span>
            <span>Until</span>
          </div>
          {WEEKDAYS.map((day) => {
            const daySchedule = schedule.days[day];
            return (
              <div className="schedule-row" key={day}>
                <span className="schedule-day">{day}</span>
                <label className="schedule-check">
                  <input
                    type="checkbox"
                    checked={daySchedule.enabled}
                    onChange={(event) =>
                      setSchedule((current) =>
                        updateDay(current, day, { enabled: event.target.checked })
                      )
                    }
                  />
                </label>
                <select
                  value={daySchedule.startHour}
                  disabled={!daySchedule.enabled}
                  onChange={(event) =>
                    setSchedule((current) =>
                      updateDay(current, day, { startHour: Number(event.target.value) })
                    )
                  }
                >
                  {HOUR_OPTIONS.map((hour) => (
                    <option key={`${day}-start-${hour}`} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ))}
                </select>
                <select
                  value={daySchedule.endHour}
                  disabled={!daySchedule.enabled}
                  onChange={(event) =>
                    setSchedule((current) =>
                      updateDay(current, day, { endHour: Number(event.target.value) })
                    )
                  }
                >
                  {HOUR_OPTIONS.filter((hour) => hour > daySchedule.startHour).map((hour) => (
                    <option key={`${day}-end-${hour}`} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="toolbar">
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void saveNotificationSettings()}
          >
            Save notification schedule
          </button>
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={resetSchedule}
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <p className="calendar-meta">
        {totalWeeks}-week plan ·{" "}
        {preview ? `${preview.length} upcoming reminders` : "Set a release date to preview"}{" "}
        · Suggested release: {suggestedDate}
        {pushPreview && pushPreview.length > 0
          ? ` · Next push window: ${pushPreview[0].pushAt?.toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}`
          : ""}
      </p>

      <div className="toolbar">
        <button
          type="button"
          className="button"
          disabled={busy || !releaseDate}
          onClick={() => void saveReleaseDate()}
        >
          Save release date
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => void exportToCalendar()}
        >
          {isNative ? "Add to Apple Calendar" : "Download calendar file"}
        </button>
        {!releaseDate ? (
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => onReleaseDateChange(suggestedDate)}
          >
            Use suggested date
          </button>
        ) : null}
      </div>

      {isNative ? (
        <p className="calendar-hint">
          On iPhone: tap <strong>Add to Apple Calendar</strong>, pick{" "}
          <strong>{DEFAULT_CALENDAR_NAME}</strong> (or create it first in Calendar.app on
          Mac), then enable Calendar notifications in Settings.
        </p>
      ) : (
        <p className="calendar-hint">
          Mac auto-sync: set iCloud credentials in <code>.env</code>, create calendar{" "}
          <strong>{DEFAULT_CALENDAR_NAME}</strong>, then run{" "}
          <code>npm run sync:icloud</code>. Optional Pushcut nudges:{" "}
          <code>npm run push:nudges</code> — uses this schedule from your project database.
        </p>
      )}
    </div>
  );
}
