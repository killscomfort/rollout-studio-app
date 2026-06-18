import { v4 as uuid } from "uuid";
import type {
  CreateProjectInput,
  Phase,
  PhaseColor,
  ProjectDetail,
  ProjectSummary,
  ProjectTemplate,
  Task,
  TaskCategory,
  UpdateProjectInput,
  Week,
} from "../../../shared/types";
import { suggestReleaseDate } from "../../../shared/calendar";
import {
  parseNotificationSchedule,
  type NotificationSchedule,
} from "../../../shared/notification-schedule";
import {
  countTemplateWeeks,
  DEFAULT_TEMPLATE_SLUG,
  personalizeTemplateForNewProject,
} from "../../../shared/template-personalize";
import { TEMPLATES } from "./templates";
import {
  createSyncBundle,
  mergeSyncData,
  type SyncBundle,
  type SyncData,
  validateSyncBundle,
} from "../../../shared/sync";

const STORAGE_KEY = "rollout-studio-native-db";

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  bookingUrl: string;
  funnelNote: string;
  releaseDate: string | null;
  notificationSchedule: NotificationSchedule | null;
  createdAt: string;
  updatedAt: string;
}

interface PhaseRow {
  id: string;
  projectId: string;
  sortOrder: number;
  title: string;
  color: PhaseColor;
}

interface WeekRow {
  id: string;
  phaseId: string;
  sortOrder: number;
  label: string;
  subtitle: string;
}

interface TaskRow {
  id: string;
  weekId: string;
  sortOrder: number;
  day: string;
  category: TaskCategory;
  task: string;
}

interface ProgressRow {
  projectId: string;
  taskId: string;
  completedAt: string;
}

interface NativeDb {
  projects: ProjectRow[];
  phases: PhaseRow[];
  weeks: WeekRow[];
  tasks: TaskRow[];
  progress: ProgressRow[];
}

let db: NativeDb | null = null;
let ready: Promise<void> | null = null;

function emptyDb(): NativeDb {
  return {
    projects: [],
    phases: [],
    weeks: [],
    tasks: [],
    progress: [],
  };
}

function loadDb(): NativeDb {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyDb();
  }
  try {
    const parsed = JSON.parse(raw) as NativeDb;
    for (const project of parsed.projects) {
      project.releaseDate = project.releaseDate ?? null;
      project.notificationSchedule =
        parseNotificationSchedule(project.notificationSchedule) ?? null;
    }
    return parsed;
  } catch {
    return emptyDb();
  }
}

function saveDb() {
  if (!db) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

async function getDb() {
  if (!ready) {
    ready = initDb();
  }
  await ready;
  if (!db) {
    throw new Error("Local database failed to initialize");
  }
  return db;
}

async function initDb() {
  db = loadDb();
  if (db.projects.length === 0) {
    const seed = TEMPLATES[DEFAULT_TEMPLATE_SLUG];
    await createProjectFromTemplate({
      name: seed.name,
      slug: seed.slug,
      tagline: seed.tagline,
      bookingUrl: seed.bookingUrl,
      funnelNote: seed.funnelNote,
      templateSlug: DEFAULT_TEMPLATE_SLUG,
    });
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "project"
  );
}

function uniqueSlug(base: string, database: NativeDb) {
  let slug = slugify(base);
  let suffix = 1;
  while (database.projects.some((project) => project.slug === slug)) {
    slug = `${slugify(base)}-${suffix++}`;
  }
  return slug;
}

function mapSummary(project: ProjectRow, database: NativeDb): ProjectSummary {
  const phaseIds = database.phases
    .filter((phase) => phase.projectId === project.id)
    .map((phase) => phase.id);
  const weekIds = database.weeks
    .filter((week) => phaseIds.includes(week.phaseId))
    .map((week) => week.id);
  const totalTasks = database.tasks.filter((task) =>
    weekIds.includes(task.weekId)
  ).length;
  const completedTasks = database.progress.filter(
    (row) => row.projectId === project.id
  ).length;

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    tagline: project.tagline,
    bookingUrl: project.bookingUrl,
    funnelNote: project.funnelNote,
    releaseDate: project.releaseDate ?? null,
    notificationSchedule: project.notificationSchedule ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    totalTasks,
    completedTasks,
  };
}

function insertPlan(database: NativeDb, projectId: string, template: ProjectTemplate) {
  template.phases.forEach((phase, phaseIndex) => {
    const phaseId = uuid();
    database.phases.push({
      id: phaseId,
      projectId,
      sortOrder: phaseIndex,
      title: phase.title,
      color: phase.color,
    });

    phase.weeks.forEach((week, weekIndex) => {
      const weekId = uuid();
      database.weeks.push({
        id: weekId,
        phaseId,
        sortOrder: weekIndex,
        label: week.label,
        subtitle: week.subtitle,
      });

      week.tasks.forEach((task, taskIndex) => {
        database.tasks.push({
          id: uuid(),
          weekId,
          sortOrder: taskIndex,
          day: task.day,
          category: task.category,
          task: task.task,
        });
      });
    });
  });
}

export async function createProjectFromTemplate(
  input: CreateProjectInput
): Promise<ProjectDetail> {
  const baseTemplate =
    TEMPLATES[input.templateSlug ?? DEFAULT_TEMPLATE_SLUG] ??
    TEMPLATES[DEFAULT_TEMPLATE_SLUG];
  const template = personalizeTemplateForNewProject(
    baseTemplate,
    input.name,
    input.bookingUrl
  );
  const database = await getDb();
  const now = new Date().toISOString();
  const id = uuid();
  const slug = input.slug
    ? uniqueSlug(input.slug, database)
    : uniqueSlug(input.name, database);
  const releaseDate = suggestReleaseDate(countTemplateWeeks(template));

  database.projects.push({
    id,
    slug,
    name: input.name,
    tagline: input.tagline ?? template.tagline,
    bookingUrl: input.bookingUrl ?? template.bookingUrl,
    funnelNote: input.funnelNote ?? template.funnelNote,
    releaseDate,
    notificationSchedule: null,
    createdAt: now,
    updatedAt: now,
  });

  insertPlan(database, id, template);
  saveDb();

  const project = await getProject(id);
  if (!project) {
    throw new Error("Failed to create project");
  }
  return project;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const database = await getDb();
  return database.projects
    .slice()
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )
    .map((project) => mapSummary(project, database));
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const database = await getDb();
  const project = database.projects.find((item) => item.id === id);
  if (!project) return null;

  const completed = new Set(
    database.progress
      .filter((row) => row.projectId === id)
      .map((row) => row.taskId)
  );

  const mappedPhases: Phase[] = database.phases
    .filter((phase) => phase.projectId === id)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((phase) => {
      const mappedWeeks: Week[] = database.weeks
        .filter((week) => week.phaseId === phase.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((week) => {
          const mappedTasks: Task[] = database.tasks
            .filter((task) => task.weekId === week.id)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((task) => ({
              id: task.id,
              day: task.day,
              category: task.category,
              task: task.task,
              completed: completed.has(task.id),
              sortOrder: task.sortOrder,
            }));

          return {
            id: week.id,
            label: week.label,
            subtitle: week.subtitle,
            sortOrder: week.sortOrder,
            tasks: mappedTasks,
          };
        });

      return {
        id: phase.id,
        title: phase.title,
        color: phase.color,
        sortOrder: phase.sortOrder,
        weeks: mappedWeeks,
      };
    });

  return { ...mapSummary(project, database), phases: mappedPhases };
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<ProjectDetail | null> {
  const existing = await getProject(id);
  if (!existing) return null;

  const database = await getDb();
  const project = database.projects.find((item) => item.id === id);
  if (!project) return null;

  project.name = input.name ?? existing.name;
  project.tagline = input.tagline ?? existing.tagline;
  project.bookingUrl = input.bookingUrl ?? existing.bookingUrl;
  project.funnelNote = input.funnelNote ?? existing.funnelNote;
  if (input.releaseDate !== undefined) {
    project.releaseDate = input.releaseDate;
  }
  if (input.notificationSchedule !== undefined) {
    project.notificationSchedule = input.notificationSchedule;
  }
  project.updatedAt = new Date().toISOString();
  saveDb();

  return getProject(id);
}

export async function deleteProject(id: string) {
  const database = await getDb();
  const phaseIds = database.phases
    .filter((phase) => phase.projectId === id)
    .map((phase) => phase.id);
  const weekIds = database.weeks
    .filter((week) => phaseIds.includes(week.phaseId))
    .map((week) => week.id);

  database.progress = database.progress.filter((row) => row.projectId !== id);
  database.tasks = database.tasks.filter((task) => !weekIds.includes(task.weekId));
  database.weeks = database.weeks.filter((week) => !phaseIds.includes(week.phaseId));
  database.phases = database.phases.filter((phase) => phase.projectId !== id);
  database.projects = database.projects.filter((project) => project.id !== id);
  saveDb();
}

export async function setTaskCompleted(
  projectId: string,
  taskId: string,
  completed: boolean
) {
  return updateTask(projectId, taskId, { completed });
}

export async function updateTask(
  projectId: string,
  taskId: string,
  input: {
    completed?: boolean;
    day?: string;
    category?: TaskCategory;
    task?: string;
  }
) {
  const database = await getDb();
  const task = database.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error("Task not found for project");
  }

  const week = database.weeks.find((item) => item.id === task.weekId);
  const phase = week
    ? database.phases.find((item) => item.id === week.phaseId)
    : undefined;

  if (!phase || phase.projectId !== projectId) {
    throw new Error("Task not found for project");
  }

  if (input.completed !== undefined) {
    database.progress = database.progress.filter(
      (row) => !(row.projectId === projectId && row.taskId === taskId)
    );

    if (input.completed) {
      database.progress.push({
        projectId,
        taskId,
        completedAt: new Date().toISOString(),
      });
    }
  }

  if (input.day !== undefined) {
    task.day = input.day;
  }
  if (input.category !== undefined) {
    task.category = input.category;
  }
  if (input.task !== undefined) {
    task.task = input.task;
  }

  const project = database.projects.find((item) => item.id === projectId);
  if (project) {
    project.updatedAt = new Date().toISOString();
  }

  saveDb();
}

export async function replacePlan(projectId: string, template: ProjectTemplate) {
  const database = await getDb();
  const phaseIds = database.phases
    .filter((phase) => phase.projectId === projectId)
    .map((phase) => phase.id);
  const weekIds = database.weeks
    .filter((week) => phaseIds.includes(week.phaseId))
    .map((week) => week.id);

  database.progress = database.progress.filter((row) => row.projectId !== projectId);
  database.tasks = database.tasks.filter((task) => !weekIds.includes(task.weekId));
  database.weeks = database.weeks.filter((week) => !phaseIds.includes(week.phaseId));
  database.phases = database.phases.filter((phase) => phase.projectId !== projectId);

  insertPlan(database, projectId, template);

  const project = database.projects.find((item) => item.id === projectId);
  if (project) {
    project.updatedAt = new Date().toISOString();
  }

  saveDb();

  const next = await getProject(projectId);
  if (!next) {
    throw new Error("Failed to replace plan");
  }
  return next;
}

export async function resetPlan(projectId: string, templateSlug: string) {
  const baseTemplate = TEMPLATES[templateSlug];
  if (!baseTemplate) {
    throw new Error("Unknown template");
  }
  const existing = await getProject(projectId);
  if (!existing) {
    throw new Error("Project not found");
  }
  const template = personalizeTemplateForNewProject(
    baseTemplate,
    existing.name,
    existing.bookingUrl
  );
  return replacePlan(projectId, template);
}

export function initLocalDatabase() {
  return getDb();
}

function snapshot(database: NativeDb): SyncData {
  return {
    projects: database.projects.map((project) => ({ ...project })),
    phases: database.phases.map((phase) => ({ ...phase })),
    weeks: database.weeks.map((week) => ({ ...week })),
    tasks: database.tasks.map((task) => ({ ...task })),
    progress: database.progress.map((row) => ({ ...row })),
  };
}

function replaceAll(database: NativeDb, data: SyncData) {
  database.projects = data.projects.map((project) => ({
    ...project,
    releaseDate: project.releaseDate ?? null,
    notificationSchedule: project.notificationSchedule ?? null,
  }));
  database.phases = data.phases.map((phase) => ({
    ...phase,
    color: phase.color as PhaseRow["color"],
  }));
  database.weeks = data.weeks.map((week) => ({ ...week }));
  database.tasks = data.tasks.map((task) => ({
    ...task,
    category: task.category as TaskRow["category"],
  }));
  database.progress = data.progress.map((row) => ({ ...row }));
}

export async function exportSyncBundle(): Promise<SyncBundle> {
  const database = await getDb();
  return createSyncBundle(snapshot(database), "mobile");
}

export async function importSyncBundle(bundle: SyncBundle) {
  validateSyncBundle(bundle);
  const database = await getDb();
  const { data, result } = mergeSyncData(snapshot(database), bundle.data);
  replaceAll(database, data);
  saveDb();
  return result;
}
