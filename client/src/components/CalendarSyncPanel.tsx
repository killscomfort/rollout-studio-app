import { Capacitor } from "@capacitor/core";
import { useMemo, useState } from "react";
import type { ProjectDetail } from "../../../shared/types";
import {
  buildCalendarEvents,
  buildProjectIcs,
  countPlanWeeks,
  DEFAULT_CALENDAR_ALERT_MINUTES,
  DEFAULT_CALENDAR_NAME,
  DEFAULT_CALENDAR_TIMEZONE,
  suggestReleaseDate,
} from "../../../shared/calendar";
import { api } from "../api";

interface CalendarSyncPanelProps {
  project: ProjectDetail;
  releaseDate: string;
  onReleaseDateChange: (value: string) => void;
  onProjectUpdated: (project: ProjectDetail) => void;
}

function slugifyFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "rollout";
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

export function CalendarSyncPanel({
  project,
  releaseDate,
  onReleaseDateChange,
  onProjectUpdated,
}: CalendarSyncPanelProps) {
  const isNative = Capacitor.isNativePlatform();
  const [reminderMinutes, setReminderMinutes] = useState(DEFAULT_CALENDAR_ALERT_MINUTES);
  const [timezone, setTimezone] = useState(DEFAULT_CALENDAR_TIMEZONE);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      timezone,
      calendarName: `${project.name} Rollout`,
      skipCompleted: true,
    });
  }, [project, releaseDate, reminderMinutes, timezone]);

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
        timezone,
        calendarName: `${project.name} Rollout`,
        skipCompleted: true,
      });

      if (events.length === 0) {
        throw new Error("No upcoming tasks to add. Set a release date or uncheck completed tasks.");
      }

      const ics = buildProjectIcs(project, {
        releaseDate: date,
        reminderMinutesBefore: reminderMinutes,
        timezone,
        calendarName: `${project.name} Rollout`,
        skipCompleted: true,
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

  return (
    <div className="panel-card calendar-panel">
      <h2 className="section-title">Apple Calendar reminders</h2>
      <p className="sync-copy">
        Turn rollout tasks into calendar events with native iPhone alerts. On iPhone, export
        and add to a calendar like <strong>{DEFAULT_CALENDAR_NAME}</strong>. On Mac, use{" "}
        <code>npm run sync:icloud</code> for automatic iCloud sync (see SHARING.md).
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
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Chicago">America/Chicago</option>
            <option value="America/Denver">America/Denver</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
      </div>

      <p className="calendar-meta">
        {totalWeeks}-week plan ·{" "}
        {preview ? `${preview.length} upcoming reminders` : "Set a release date to preview"}{" "}
        · Suggested release: {suggestedDate}
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
          <code>npm run push:nudges</code>.
        </p>
      )}
    </div>
  );
}
