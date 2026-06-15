import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type {
  CreateProjectInput,
  Phase,
  PhaseColor,
  PhaseTemplate,
  ProjectDetail,
  ProjectSummary,
  ProjectTemplate,
  Task,
  TaskCategory,
  UpdateProjectInput,
  Week,
} from "../../shared/types";
import { TEMPLATES, BLANK_TEMPLATE } from "./templates";

const dataDir =
  process.env.ROLLOUT_DATA_DIR ??
  path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "rollout-studio.db");

export function getDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function initDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      booking_url TEXT NOT NULL DEFAULT '',
      funnel_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weeks (
      id TEXT PRIMARY KEY,
      phase_id TEXT NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      week_id TEXT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      day TEXT NOT NULL,
      category TEXT NOT NULL,
      task TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_progress (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      PRIMARY KEY (project_id, task_id)
    );
  `);

  const projectColumns = db
    .prepare("PRAGMA table_info(projects)")
    .all() as Array<{ name: string }>;
  if (!projectColumns.some((column) => column.name === "release_date")) {
    db.exec("ALTER TABLE projects ADD COLUMN release_date TEXT");
  }

  const count = db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number };
  if (count.c === 0) {
    createProjectFromTemplate(db, {
      name: BLANK_TEMPLATE.name,
      slug: BLANK_TEMPLATE.slug,
      tagline: BLANK_TEMPLATE.tagline,
      bookingUrl: BLANK_TEMPLATE.bookingUrl,
      funnelNote: BLANK_TEMPLATE.funnelNote,
      templateSlug: "blank",
    });
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "project";
}

function uniqueSlug(db: Database.Database, base: string) {
  let slug = slugify(base);
  let suffix = 1;
  while (db.prepare("SELECT 1 FROM projects WHERE slug = ?").get(slug)) {
    slug = `${slugify(base)}-${suffix++}`;
  }
  return slug;
}

function insertPlan(db: Database.Database, projectId: string, template: ProjectTemplate) {
  const insertPhase = db.prepare(
    "INSERT INTO phases (id, project_id, sort_order, title, color) VALUES (?, ?, ?, ?, ?)"
  );
  const insertWeek = db.prepare(
    "INSERT INTO weeks (id, phase_id, sort_order, label, subtitle) VALUES (?, ?, ?, ?, ?)"
  );
  const insertTask = db.prepare(
    "INSERT INTO tasks (id, week_id, sort_order, day, category, task) VALUES (?, ?, ?, ?, ?, ?)"
  );

  template.phases.forEach((phase: PhaseTemplate, phaseIndex) => {
    const phaseId = uuid();
    insertPhase.run(phaseId, projectId, phaseIndex, phase.title, phase.color);
    phase.weeks.forEach((week, weekIndex) => {
      const weekId = uuid();
      insertWeek.run(weekId, phaseId, weekIndex, week.label, week.subtitle);
      week.tasks.forEach((task, taskIndex) => {
        insertTask.run(
          uuid(),
          weekId,
          taskIndex,
          task.day,
          task.category,
          task.task
        );
      });
    });
  });
}

export function createProjectFromTemplate(
  db: Database.Database,
  input: CreateProjectInput
): ProjectDetail {
  const template =
    TEMPLATES[input.templateSlug ?? "blank"] ?? TEMPLATES.blank;
  const now = new Date().toISOString();
  const id = uuid();
  const slug = input.slug ? uniqueSlug(db, input.slug) : uniqueSlug(db, input.name);

  db.prepare(
    `INSERT INTO projects (id, slug, name, tagline, booking_url, funnel_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    slug,
    input.name,
    input.tagline ?? template.tagline,
    input.bookingUrl ?? template.bookingUrl,
    input.funnelNote ?? template.funnelNote,
    now,
    now
  );

  insertPlan(db, id, template);
  return getProject(db, id)!;
}

export function listProjects(db: Database.Database): ProjectSummary[] {
  const rows = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM tasks t
          JOIN weeks w ON w.id = t.week_id
          JOIN phases ph ON ph.id = w.phase_id
          WHERE ph.project_id = p.id) AS total_tasks,
        (SELECT COUNT(*) FROM task_progress tp
          WHERE tp.project_id = p.id AND tp.completed = 1) AS completed_tasks
       FROM projects p
       ORDER BY p.updated_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map(mapSummary);
}

function mapReleaseDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function mapSummary(row: Record<string, unknown>): ProjectSummary {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    tagline: String(row.tagline),
    bookingUrl: String(row.booking_url),
    funnelNote: String(row.funnel_note),
    releaseDate: mapReleaseDate(row.release_date),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    totalTasks: Number(row.total_tasks ?? 0),
    completedTasks: Number(row.completed_tasks ?? 0),
  };
}

export function getProject(db: Database.Database, id: string): ProjectDetail | null {
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!project) return null;

  const completed = new Set(
    (
      db
        .prepare(
          "SELECT task_id FROM task_progress WHERE project_id = ? AND completed = 1"
        )
        .all(id) as Array<{ task_id: string }>
    ).map((row) => row.task_id)
  );

  const phases = db
    .prepare(
      "SELECT * FROM phases WHERE project_id = ? ORDER BY sort_order ASC"
    )
    .all(id) as Array<Record<string, unknown>>;

  const mappedPhases: Phase[] = phases.map((phaseRow) => {
    const weeks = db
      .prepare("SELECT * FROM weeks WHERE phase_id = ? ORDER BY sort_order ASC")
      .all(String(phaseRow.id)) as Array<Record<string, unknown>>;

    const mappedWeeks: Week[] = weeks.map((weekRow) => {
      const tasks = db
        .prepare("SELECT * FROM tasks WHERE week_id = ? ORDER BY sort_order ASC")
        .all(String(weekRow.id)) as Array<Record<string, unknown>>;

      const mappedTasks: Task[] = tasks.map((taskRow) => ({
        id: String(taskRow.id),
        day: String(taskRow.day),
        category: String(taskRow.category) as TaskCategory,
        task: String(taskRow.task),
        completed: completed.has(String(taskRow.id)),
        sortOrder: Number(taskRow.sort_order),
      }));

      return {
        id: String(weekRow.id),
        label: String(weekRow.label),
        subtitle: String(weekRow.subtitle),
        sortOrder: Number(weekRow.sort_order),
        tasks: mappedTasks,
      };
    });

    return {
      id: String(phaseRow.id),
      title: String(phaseRow.title),
      color: String(phaseRow.color) as PhaseColor,
      sortOrder: Number(phaseRow.sort_order),
      weeks: mappedWeeks,
    };
  });

  const summary = mapSummary({
    ...project,
    total_tasks: mappedPhases.reduce(
      (sum, phase) =>
        sum + phase.weeks.reduce((weekSum, week) => weekSum + week.tasks.length, 0),
      0
    ),
    completed_tasks: mappedPhases.reduce(
      (sum, phase) =>
        sum +
        phase.weeks.reduce(
          (weekSum, week) =>
            weekSum + week.tasks.filter((task) => task.completed).length,
          0
        ),
      0
    ),
  });

  return { ...summary, phases: mappedPhases };
}

export function updateProject(
  db: Database.Database,
  id: string,
  input: UpdateProjectInput
): ProjectDetail | null {
  const existing = getProject(db, id);
  if (!existing) return null;

  db.prepare(
    `UPDATE projects
     SET name = ?, tagline = ?, booking_url = ?, funnel_note = ?, release_date = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.name ?? existing.name,
    input.tagline ?? existing.tagline,
    input.bookingUrl ?? existing.bookingUrl,
    input.funnelNote ?? existing.funnelNote,
    input.releaseDate !== undefined
      ? input.releaseDate
      : existing.releaseDate,
    new Date().toISOString(),
    id
  );

  return getProject(db, id);
}

export function deleteProject(db: Database.Database, id: string) {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export function setTaskCompleted(
  db: Database.Database,
  projectId: string,
  taskId: string,
  completed: boolean
) {
  updateTask(db, projectId, taskId, { completed });
}

export function updateTask(
  db: Database.Database,
  projectId: string,
  taskId: string,
  input: {
    completed?: boolean;
    day?: string;
    category?: string;
    task?: string;
  }
) {
  const ownsTask = db
    .prepare(
      `SELECT 1 FROM tasks t
       JOIN weeks w ON w.id = t.week_id
       JOIN phases p ON p.id = w.phase_id
       WHERE t.id = ? AND p.project_id = ?`
    )
    .get(taskId, projectId);

  if (!ownsTask) {
    throw new Error("Task not found for project");
  }

  if (input.completed !== undefined) {
    if (input.completed) {
      db.prepare(
        `INSERT INTO task_progress (project_id, task_id, completed, completed_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(project_id, task_id) DO UPDATE SET
           completed = 1,
           completed_at = excluded.completed_at`
      ).run(projectId, taskId, new Date().toISOString());
    } else {
      db.prepare(
        "DELETE FROM task_progress WHERE project_id = ? AND task_id = ?"
      ).run(projectId, taskId);
    }
  }

  const updates: string[] = [];
  const params: Array<string> = [];

  if (input.day !== undefined) {
    updates.push("day = ?");
    params.push(input.day);
  }
  if (input.category !== undefined) {
    updates.push("category = ?");
    params.push(input.category);
  }
  if (input.task !== undefined) {
    updates.push("task = ?");
    params.push(input.task);
  }

  if (updates.length > 0) {
    db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
      taskId
    );
  }

  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    projectId
  );
}

export function replacePlan(
  db: Database.Database,
  projectId: string,
  template: ProjectTemplate
) {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM phases WHERE project_id = ?").run(projectId);
    insertPlan(db, projectId, template);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      projectId
    );
  });
  tx();
  return getProject(db, projectId);
}
