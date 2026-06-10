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
import {
  createSyncBundle,
  mergeSyncData,
  type SyncBundle,
  type SyncData,
  validateSyncBundle,
} from "../../../shared/sync";
import { getSupabase, requireUserId } from "../lib/supabase";
import { TEMPLATES, BLANK_TEMPLATE } from "./templates";

interface ProjectRow {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  tagline: string;
  booking_url: string;
  funnel_note: string;
  created_at: string;
  updated_at: string;
}

interface PhaseRow {
  id: string;
  project_id: string;
  sort_order: number;
  title: string;
  color: string;
}

interface WeekRow {
  id: string;
  phase_id: string;
  sort_order: number;
  label: string;
  subtitle: string;
}

interface TaskRow {
  id: string;
  week_id: string;
  sort_order: number;
  day: string;
  category: string;
  task: string;
}

interface ProgressRow {
  project_id: string;
  task_id: string;
  completed_at: string;
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

async function uniqueSlug(base: string, userId: string) {
  const supabase = getSupabase();
  let slug = slugify(base);
  let suffix = 1;

  while (true) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    slug = `${slugify(base)}-${suffix++}`;
  }
}

async function fetchUserData(userId: string): Promise<SyncData> {
  const supabase = getSupabase();
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId);

  if (projectError) throw new Error(projectError.message);

  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);

  if (projectIds.length === 0) {
    return {
      projects: [],
      phases: [],
      weeks: [],
      tasks: [],
      progress: [],
    };
  }

  const [{ data: phases }, { data: progress }] = await Promise.all([
    supabase.from("phases").select("*").in("project_id", projectIds),
    supabase.from("task_progress").select("*").eq("user_id", userId),
  ]);

  const phaseRows = (phases ?? []) as PhaseRow[];
  const phaseIds = phaseRows.map((phase) => phase.id);

  let weekRows: WeekRow[] = [];
  if (phaseIds.length > 0) {
    const { data: weeks, error: weekError } = await supabase
      .from("weeks")
      .select("*")
      .in("phase_id", phaseIds);
    if (weekError) throw new Error(weekError.message);
    weekRows = (weeks ?? []) as WeekRow[];
  }

  const weekIds = weekRows.map((week) => week.id);
  let taskRows: TaskRow[] = [];
  if (weekIds.length > 0) {
    const { data: tasks, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .in("week_id", weekIds);
    if (taskError) throw new Error(taskError.message);
    taskRows = (tasks ?? []) as TaskRow[];
  }

  return {
    projects: projectRows.map((project) => ({
      id: project.id,
      slug: project.slug,
      name: project.name,
      tagline: project.tagline,
      bookingUrl: project.booking_url,
      funnelNote: project.funnel_note,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    })),
    phases: phaseRows.map((phase) => ({
      id: phase.id,
      projectId: phase.project_id,
      sortOrder: phase.sort_order,
      title: phase.title,
      color: phase.color as PhaseColor,
    })),
    weeks: weekRows.map((week) => ({
      id: week.id,
      phaseId: week.phase_id,
      sortOrder: week.sort_order,
      label: week.label,
      subtitle: week.subtitle,
    })),
    tasks: taskRows.map((task) => ({
      id: task.id,
      weekId: task.week_id,
      sortOrder: task.sort_order,
      day: task.day,
      category: task.category as TaskCategory,
      task: task.task,
    })),
    progress: ((progress ?? []) as ProgressRow[]).map((row) => ({
      projectId: row.project_id,
      taskId: row.task_id,
      completedAt: row.completed_at,
    })),
  };
}

function mapSummary(project: SyncData["projects"][number], data: SyncData): ProjectSummary {
  const phaseIds = data.phases
    .filter((phase) => phase.projectId === project.id)
    .map((phase) => phase.id);
  const weekIds = data.weeks
    .filter((week) => phaseIds.includes(week.phaseId))
    .map((week) => week.id);
  const totalTasks = data.tasks.filter((task) => weekIds.includes(task.weekId)).length;
  const completedTasks = data.progress.filter((row) => row.projectId === project.id).length;

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    tagline: project.tagline,
    bookingUrl: project.bookingUrl,
    funnelNote: project.funnelNote,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    totalTasks,
    completedTasks,
  };
}

function buildProjectDetail(
  project: SyncData["projects"][number],
  data: SyncData
): ProjectDetail {
  const completed = new Set(
    data.progress
      .filter((row) => row.projectId === project.id)
      .map((row) => row.taskId)
  );

  const phases: Phase[] = data.phases
    .filter((phase) => phase.projectId === project.id)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((phase) => {
      const weeks: Week[] = data.weeks
        .filter((week) => week.phaseId === phase.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((week) => {
          const tasks: Task[] = data.tasks
            .filter((task) => task.weekId === week.id)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((task) => ({
              id: task.id,
              day: task.day,
              category: task.category as TaskCategory,
              task: task.task,
              completed: completed.has(task.id),
              sortOrder: task.sortOrder,
            }));

          return {
            id: week.id,
            label: week.label,
            subtitle: week.subtitle,
            sortOrder: week.sortOrder,
            tasks,
          };
        });

      return {
        id: phase.id,
        title: phase.title,
        color: phase.color as PhaseColor,
        sortOrder: phase.sortOrder,
        weeks,
      };
    });

  return { ...mapSummary(project, data), phases };
}

async function insertPlan(userId: string, projectId: string, template: ProjectTemplate) {
  const supabase = getSupabase();

  for (let phaseIndex = 0; phaseIndex < template.phases.length; phaseIndex++) {
    const phase = template.phases[phaseIndex];
    const phaseId = uuid();
    const { error: phaseError } = await supabase.from("phases").insert({
      id: phaseId,
      project_id: projectId,
      sort_order: phaseIndex,
      title: phase.title,
      color: phase.color,
    });
    if (phaseError) throw new Error(phaseError.message);

    for (let weekIndex = 0; weekIndex < phase.weeks.length; weekIndex++) {
      const week = phase.weeks[weekIndex];
      const weekId = uuid();
      const { error: weekError } = await supabase.from("weeks").insert({
        id: weekId,
        phase_id: phaseId,
        sort_order: weekIndex,
        label: week.label,
        subtitle: week.subtitle,
      });
      if (weekError) throw new Error(weekError.message);

      if (week.tasks.length > 0) {
        const { error: taskError } = await supabase.from("tasks").insert(
          week.tasks.map((task, taskIndex) => ({
            id: uuid(),
            week_id: weekId,
            sort_order: taskIndex,
            day: task.day,
            category: task.category,
            task: task.task,
          }))
        );
        if (taskError) throw new Error(taskError.message);
      }
    }
  }
}

export async function initSupabaseStore() {
  const userId = await requireUserId();
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  if ((count ?? 0) === 0) {
    await createProjectFromTemplate({
      name: BLANK_TEMPLATE.name,
      slug: BLANK_TEMPLATE.slug,
      tagline: BLANK_TEMPLATE.tagline,
      bookingUrl: BLANK_TEMPLATE.bookingUrl,
      funnelNote: BLANK_TEMPLATE.funnelNote,
      templateSlug: "blank",
    });
  }
}

export async function createProjectFromTemplate(
  input: CreateProjectInput
): Promise<ProjectDetail> {
  const template = TEMPLATES[input.templateSlug ?? "blank"] ?? TEMPLATES.blank;
  const userId = await requireUserId();
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const id = uuid();
  const slug = input.slug
    ? await uniqueSlug(input.slug, userId)
    : await uniqueSlug(input.name, userId);

  const { error } = await supabase.from("projects").insert({
    id,
    user_id: userId,
    slug,
    name: input.name,
    tagline: input.tagline ?? template.tagline,
    booking_url: input.bookingUrl ?? template.bookingUrl,
    funnel_note: input.funnelNote ?? template.funnelNote,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new Error(error.message);

  await insertPlan(userId, id, template);

  const project = await getProject(id);
  if (!project) {
    throw new Error("Failed to create project");
  }
  return project;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const userId = await requireUserId();
  const data = await fetchUserData(userId);
  return data.projects
    .slice()
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )
    .map((project) => mapSummary(project, data));
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const userId = await requireUserId();
  const data = await fetchUserData(userId);
  const project = data.projects.find((item) => item.id === id);
  if (!project) return null;
  return buildProjectDetail(project, data);
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<ProjectDetail | null> {
  const existing = await getProject(id);
  if (!existing) return null;

  const supabase = getSupabase();
  const { error } = await supabase
    .from("projects")
    .update({
      name: input.name ?? existing.name,
      tagline: input.tagline ?? existing.tagline,
      booking_url: input.bookingUrl ?? existing.bookingUrl,
      funnel_note: input.funnelNote ?? existing.funnelNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  return getProject(id);
}

export async function deleteProject(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setTaskCompleted(
  projectId: string,
  taskId: string,
  completed: boolean
) {
  const userId = await requireUserId();
  const supabase = getSupabase();

  if (completed) {
    const { error } = await supabase.from("task_progress").upsert({
      project_id: projectId,
      task_id: taskId,
      user_id: userId,
      completed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("task_progress")
      .delete()
      .eq("project_id", projectId)
      .eq("task_id", taskId);
    if (error) throw new Error(error.message);
  }

  const { error: projectError } = await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (projectError) throw new Error(projectError.message);
}

export async function replacePlan(projectId: string, template: ProjectTemplate) {
  const userId = await requireUserId();
  const supabase = getSupabase();

  const { data: phases, error: phaseError } = await supabase
    .from("phases")
    .select("id")
    .eq("project_id", projectId);

  if (phaseError) throw new Error(phaseError.message);

  const phaseIds = (phases ?? []).map((phase) => phase.id);
  if (phaseIds.length > 0) {
    const { data: weeks, error: weekError } = await supabase
      .from("weeks")
      .select("id")
      .in("phase_id", phaseIds);

    if (weekError) throw new Error(weekError.message);

    const weekIds = (weeks ?? []).map((week) => week.id);
    if (weekIds.length > 0) {
      const { error: taskDeleteError } = await supabase
        .from("tasks")
        .delete()
        .in("week_id", weekIds);
      if (taskDeleteError) throw new Error(taskDeleteError.message);
    }

    const { error: weekDeleteError } = await supabase
      .from("weeks")
      .delete()
      .in("phase_id", phaseIds);
    if (weekDeleteError) throw new Error(weekDeleteError.message);
  }

  const { error: progressDeleteError } = await supabase
    .from("task_progress")
    .delete()
    .eq("project_id", projectId);
  if (progressDeleteError) throw new Error(progressDeleteError.message);

  const { error: phaseDeleteError } = await supabase
    .from("phases")
    .delete()
    .eq("project_id", projectId);
  if (phaseDeleteError) throw new Error(phaseDeleteError.message);

  await insertPlan(userId, projectId, template);

  const { error: projectError } = await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (projectError) throw new Error(projectError.message);

  const project = await getProject(projectId);
  if (!project) {
    throw new Error("Failed to replace plan");
  }
  return project;
}

export async function resetPlan(projectId: string, templateSlug: string) {
  const template = TEMPLATES[templateSlug];
  if (!template) {
    throw new Error("Unknown template");
  }
  return replacePlan(projectId, template);
}

async function replaceAllData(userId: string, data: SyncData) {
  const supabase = getSupabase();
  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);

  for (const project of data.projects) {
    const { error } = await supabase.from("projects").insert({
      id: project.id,
      user_id: userId,
      slug: project.slug,
      name: project.name,
      tagline: project.tagline,
      booking_url: project.bookingUrl,
      funnel_note: project.funnelNote,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    });
    if (error) throw new Error(error.message);
  }

  if (data.phases.length > 0) {
    const { error } = await supabase.from("phases").insert(
      data.phases.map((phase) => ({
        id: phase.id,
        project_id: phase.projectId,
        sort_order: phase.sortOrder,
        title: phase.title,
        color: phase.color,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (data.weeks.length > 0) {
    const { error } = await supabase.from("weeks").insert(
      data.weeks.map((week) => ({
        id: week.id,
        phase_id: week.phaseId,
        sort_order: week.sortOrder,
        label: week.label,
        subtitle: week.subtitle,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (data.tasks.length > 0) {
    const { error } = await supabase.from("tasks").insert(
      data.tasks.map((task) => ({
        id: task.id,
        week_id: task.weekId,
        sort_order: task.sortOrder,
        day: task.day,
        category: task.category,
        task: task.task,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (data.progress.length > 0) {
    const { error } = await supabase.from("task_progress").insert(
      data.progress.map((row) => ({
        project_id: row.projectId,
        task_id: row.taskId,
        user_id: userId,
        completed_at: row.completedAt,
      }))
    );
    if (error) throw new Error(error.message);
  }
}

export async function exportSyncBundle(): Promise<SyncBundle> {
  const userId = await requireUserId();
  const data = await fetchUserData(userId);
  return createSyncBundle(data, "mobile");
}

export async function importSyncBundle(bundle: SyncBundle) {
  validateSyncBundle(bundle);
  const userId = await requireUserId();
  const local = await fetchUserData(userId);
  const { data, result } = mergeSyncData(local, bundle.data);
  await replaceAllData(userId, data);
  return result;
}

export async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  await initSupabaseStore();
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (data.session) {
    await initSupabaseStore();
  }
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw new Error(error.message);
}

export function onAuthStateChange(callback: (signedIn: boolean) => void) {
  const supabase = getSupabase();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(Boolean(session));
  });
  return () => subscription.unsubscribe();
}
