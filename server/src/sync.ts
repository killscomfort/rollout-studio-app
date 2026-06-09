import Database from "better-sqlite3";
import type { SyncData } from "../../shared/sync";
import { createSyncBundle, mergeSyncData, type SyncBundle } from "../../shared/sync";

type Row = Record<string, unknown>;

export function exportSyncData(db: Database.Database): SyncData {
  const projects = (
    db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Row[]
  ).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    tagline: String(row.tagline),
    bookingUrl: String(row.booking_url),
    funnelNote: String(row.funnel_note),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  const phases = (
    db.prepare("SELECT * FROM phases ORDER BY sort_order ASC").all() as Row[]
  ).map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    sortOrder: Number(row.sort_order),
    title: String(row.title),
    color: String(row.color),
  }));

  const weeks = (
    db.prepare("SELECT * FROM weeks ORDER BY sort_order ASC").all() as Row[]
  ).map((row) => ({
    id: String(row.id),
    phaseId: String(row.phase_id),
    sortOrder: Number(row.sort_order),
    label: String(row.label),
    subtitle: String(row.subtitle),
  }));

  const tasks = (
    db.prepare("SELECT * FROM tasks ORDER BY sort_order ASC").all() as Row[]
  ).map((row) => ({
    id: String(row.id),
    weekId: String(row.week_id),
    sortOrder: Number(row.sort_order),
    day: String(row.day),
    category: String(row.category),
    task: String(row.task),
  }));

  const progress = (
    db
      .prepare("SELECT project_id, task_id, completed_at FROM task_progress WHERE completed = 1")
      .all() as Row[]
  ).map((row) => ({
    projectId: String(row.project_id),
    taskId: String(row.task_id),
    completedAt: String(row.completed_at ?? new Date().toISOString()),
  }));

  return { projects, phases, weeks, tasks, progress };
}

function replaceAllData(db: Database.Database, data: SyncData) {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM task_progress").run();
    db.prepare("DELETE FROM tasks").run();
    db.prepare("DELETE FROM weeks").run();
    db.prepare("DELETE FROM phases").run();
    db.prepare("DELETE FROM projects").run();

    const insertProject = db.prepare(
      `INSERT INTO projects (id, slug, name, tagline, booking_url, funnel_note, created_at, updated_at)
       VALUES (@id, @slug, @name, @tagline, @bookingUrl, @funnelNote, @createdAt, @updatedAt)`
    );
    const insertPhase = db.prepare(
      `INSERT INTO phases (id, project_id, sort_order, title, color)
       VALUES (@id, @projectId, @sortOrder, @title, @color)`
    );
    const insertWeek = db.prepare(
      `INSERT INTO weeks (id, phase_id, sort_order, label, subtitle)
       VALUES (@id, @phaseId, @sortOrder, @label, @subtitle)`
    );
    const insertTask = db.prepare(
      `INSERT INTO tasks (id, week_id, sort_order, day, category, task)
       VALUES (@id, @weekId, @sortOrder, @day, @category, @task)`
    );
    const insertProgress = db.prepare(
      `INSERT INTO task_progress (project_id, task_id, completed, completed_at)
       VALUES (@projectId, @taskId, 1, @completedAt)`
    );

    for (const project of data.projects) insertProject.run(project);
    for (const phase of data.phases) insertPhase.run(phase);
    for (const week of data.weeks) insertWeek.run(week);
    for (const task of data.tasks) insertTask.run(task);
    for (const row of data.progress) insertProgress.run(row);
  });

  tx();
}

export function exportSyncBundle(db: Database.Database): SyncBundle {
  return createSyncBundle(exportSyncData(db), "desktop");
}

export function importSyncBundle(db: Database.Database, bundle: SyncBundle) {
  const local = exportSyncData(db);
  const { data, result } = mergeSyncData(local, bundle.data);
  replaceAllData(db, data);
  return result;
}
