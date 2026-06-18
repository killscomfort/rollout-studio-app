import type { ProjectDetail } from "../../shared/types.ts";
import {
  DEFAULT_CALENDAR_ALERT_MINUTES,
  toNotificationTasks,
  type NotificationTask,
} from "../../shared/calendar.ts";
import { resolveNotificationSchedule } from "../../shared/notification-schedule.ts";
import { getDb, getProject, initDb, listProjects } from "../../server/src/db.ts";
import { notificationConfig } from "./config.ts";

export function loadProjectFromDb(projectRef?: string): ProjectDetail {
  const db = getDb();
  initDb(db);

  if (projectRef) {
    const summaries = listProjects(db);
    const match = summaries.find(
      (project) => project.id === projectRef || project.slug === projectRef
    );
    if (!match) {
      throw new Error(`Project "${projectRef}" not found in local database.`);
    }
    const detail = getProject(db, match.id);
    if (!detail) {
      throw new Error(`Project "${projectRef}" could not be loaded.`);
    }
    return detail;
  }

  const summaries = listProjects(db);
  if (summaries.length === 0) {
    throw new Error("No projects in local database. Create one in Rollout Studio first.");
  }

  const detail = getProject(db, summaries[0].id);
  if (!detail) {
    throw new Error("Failed to load the first project.");
  }
  return detail;
}

export function buildNotificationSchedule(project: ProjectDetail): {
  project: ProjectDetail;
  tasks: NotificationTask[];
} {
  if (!project.releaseDate) {
    throw new Error(
      `Project "${project.name}" has no release date. Open Project settings and set one first.`
    );
  }

  const schedule = resolveNotificationSchedule(
    project.notificationSchedule,
    notificationConfig.timezone
  );

  const tasks = toNotificationTasks(project, {
    releaseDate: project.releaseDate,
    reminderMinutesBefore:
      notificationConfig.alertMinutes || DEFAULT_CALENDAR_ALERT_MINUTES,
    timezone: schedule.timezone || notificationConfig.timezone,
    calendarName: notificationConfig.calendarName,
    skipCompleted: true,
    push: notificationConfig.pushByDefault,
    pushLeadMinutes: notificationConfig.pushLeadMinutes,
    notificationSchedule: schedule,
  });

  return { project, tasks };
}
