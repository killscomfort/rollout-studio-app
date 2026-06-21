import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ProjectDetail } from "../../shared/types.ts";
import type { SyncData } from "../../shared/sync.ts";
import { parseNotificationSchedule } from "../../shared/notification-schedule.ts";
import { parseGrowthData } from "../../shared/growth/store.ts";
import { buildProjectDetailFromSync } from "../../shared/project-from-sync.ts";

const PLACEHOLDER_VALUES = new Set([
  "your-anon-key",
  "https://your-project.supabase.co",
]);

export function hasCloudSupabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return false;
  if (PLACEHOLDER_VALUES.has(url) || PLACEHOLDER_VALUES.has(key)) return false;
  if (url.includes("your-project")) return false;
  return true;
}

async function createSupabaseClient(): Promise<SupabaseClient> {
  const url = process.env.VITE_SUPABASE_URL!.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const email = process.env.ROLLOUT_CLI_EMAIL?.trim();
  const password = process.env.ROLLOUT_CLI_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      "Supabase is configured but the notification script cannot sign in. " +
        "Add ROLLOUT_CLI_EMAIL and ROLLOUT_CLI_PASSWORD to .env (your Rollout Studio login), " +
        "or SUPABASE_SERVICE_ROLE_KEY for unattended server use."
    );
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Supabase sign-in failed: ${error.message}`);
  }
  return client;
}

async function resolveUserId(client: SupabaseClient): Promise<string> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) {
    const email = process.env.ROLLOUT_CLI_EMAIL?.trim();
    if (!email) {
      throw new Error(
        "With SUPABASE_SERVICE_ROLE_KEY, also set ROLLOUT_CLI_EMAIL so the script knows which account's projects to sync."
      );
    }
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.id) {
      throw new Error(`No Rollout profile found for ${email}. Sign in to the app once first.`);
    }
    return data.id;
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not signed in to Supabase.");
  }
  return data.user.id;
}

async function fetchUserSyncData(
  client: SupabaseClient,
  userId: string
): Promise<SyncData> {
  const { data: projects, error: projectError } = await client
    .from("projects")
    .select("*")
    .eq("user_id", userId);

  if (projectError) throw new Error(projectError.message);

  type ProjectRow = {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    booking_url: string;
    funnel_note: string;
    release_date: string | null;
    notification_schedule: unknown;
    growth_data: unknown;
    created_at: string;
    updated_at: string;
  };

  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);

  if (projectIds.length === 0) {
    return { projects: [], phases: [], weeks: [], tasks: [], progress: [] };
  }

  const [{ data: phases }, { data: progress }] = await Promise.all([
    client.from("phases").select("*").in("project_id", projectIds),
    client.from("task_progress").select("*").eq("user_id", userId),
  ]);

  type PhaseRow = {
    id: string;
    project_id: string;
    sort_order: number;
    title: string;
    color: string;
  };
  type WeekRow = {
    id: string;
    phase_id: string;
    sort_order: number;
    label: string;
    subtitle: string;
  };
  type TaskRow = {
    id: string;
    week_id: string;
    sort_order: number;
    day: string;
    category: string;
    task: string;
  };
  type ProgressRow = {
    project_id: string;
    task_id: string;
    completed_at: string;
  };

  const phaseRows = (phases ?? []) as PhaseRow[];
  const phaseIds = phaseRows.map((phase) => phase.id);

  let weekRows: WeekRow[] = [];
  if (phaseIds.length > 0) {
    const { data: weeks, error: weekError } = await client
      .from("weeks")
      .select("*")
      .in("phase_id", phaseIds);
    if (weekError) throw new Error(weekError.message);
    weekRows = (weeks ?? []) as WeekRow[];
  }

  const weekIds = weekRows.map((week) => week.id);
  let taskRows: TaskRow[] = [];
  if (weekIds.length > 0) {
    const { data: tasks, error: taskError } = await client
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
      releaseDate: project.release_date?.trim() || null,
      notificationSchedule: parseNotificationSchedule(project.notification_schedule),
      growthData: parseGrowthData(project.growth_data),
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    })),
    phases: phaseRows.map((phase) => ({
      id: phase.id,
      projectId: phase.project_id,
      sortOrder: phase.sort_order,
      title: phase.title,
      color: phase.color,
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
      category: task.category,
      task: task.task,
    })),
    progress: ((progress ?? []) as ProgressRow[]).map((row) => ({
      projectId: row.project_id,
      taskId: row.task_id,
      completedAt: row.completed_at,
    })),
  };
}

function pickProject(data: SyncData, projectRef?: string) {
  if (projectRef) {
    const match = data.projects.find(
      (project) => project.id === projectRef || project.slug === projectRef
    );
    if (!match) {
      throw new Error(`Project "${projectRef}" not found in Supabase.`);
    }
    return match;
  }

  if (data.projects.length === 0) {
    throw new Error("No projects in Supabase. Create one in Rollout Studio first.");
  }

  return data.projects[0];
}

export async function loadProjectFromSupabase(
  projectRef?: string
): Promise<ProjectDetail> {
  const client = await createSupabaseClient();
  const userId = await resolveUserId(client);
  const data = await fetchUserSyncData(client, userId);
  const project = pickProject(data, projectRef);
  return buildProjectDetailFromSync(project, data);
}
