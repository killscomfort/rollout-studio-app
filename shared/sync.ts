export const SYNC_VERSION = 1;

export interface SyncProject {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  bookingUrl: string;
  funnelNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncPhase {
  id: string;
  projectId: string;
  sortOrder: number;
  title: string;
  color: string;
}

export interface SyncWeek {
  id: string;
  phaseId: string;
  sortOrder: number;
  label: string;
  subtitle: string;
}

export interface SyncTask {
  id: string;
  weekId: string;
  sortOrder: number;
  day: string;
  category: string;
  task: string;
}

export interface SyncProgress {
  projectId: string;
  taskId: string;
  completedAt: string;
}

export interface SyncData {
  projects: SyncProject[];
  phases: SyncPhase[];
  weeks: SyncWeek[];
  tasks: SyncTask[];
  progress: SyncProgress[];
}

export interface SyncBundle {
  version: number;
  exportedAt: string;
  source: "desktop" | "mobile";
  data: SyncData;
}

export interface SyncImportResult {
  added: number;
  updated: number;
  skipped: number;
}

function taskFingerprint(
  data: SyncData,
  projectId: string,
  taskId: string
): string | null {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return null;

  const week = data.weeks.find((item) => item.id === task.weekId);
  if (!week) return null;

  const phase = data.phases.find((item) => item.id === week.phaseId);
  if (!phase || phase.projectId !== projectId) return null;

  return [
    phase.sortOrder,
    week.sortOrder,
    task.day,
    task.category,
    task.task,
  ].join("|");
}

function removeProject(data: SyncData, projectId: string) {
  const phaseIds = data.phases
    .filter((phase) => phase.projectId === projectId)
    .map((phase) => phase.id);
  const weekIds = data.weeks
    .filter((week) => phaseIds.includes(week.phaseId))
    .map((week) => week.id);

  data.projects = data.projects.filter((project) => project.id !== projectId);
  data.phases = data.phases.filter((phase) => phase.projectId !== projectId);
  data.weeks = data.weeks.filter((week) => !phaseIds.includes(week.phaseId));
  data.tasks = data.tasks.filter((task) => !weekIds.includes(task.weekId));
  data.progress = data.progress.filter((row) => row.projectId !== projectId);
}

function appendProject(data: SyncData, projectId: string, incoming: SyncData) {
  const project = incoming.projects.find((item) => item.id === projectId);
  if (!project) return;

  data.projects.push({ ...project });
  data.phases.push(
    ...incoming.phases
      .filter((phase) => phase.projectId === projectId)
      .map((phase) => ({ ...phase }))
  );

  const phaseIds = incoming.phases
    .filter((phase) => phase.projectId === projectId)
    .map((phase) => phase.id);

  data.weeks.push(
    ...incoming.weeks
      .filter((week) => phaseIds.includes(week.phaseId))
      .map((week) => ({ ...week }))
  );

  const weekIds = incoming.weeks
    .filter((week) => phaseIds.includes(week.phaseId))
    .map((week) => week.id);

  data.tasks.push(
    ...incoming.tasks
      .filter((task) => weekIds.includes(task.weekId))
      .map((task) => ({ ...task }))
  );

  data.progress.push(
    ...incoming.progress
      .filter((row) => row.projectId === projectId)
      .map((row) => ({ ...row }))
  );
}

function mergeProgressByFingerprint(
  target: SyncData,
  localProjectId: string,
  incoming: SyncData,
  incomingProjectId: string
) {
  const localMap = new Map<string, string>();
  for (const task of target.tasks.filter((item) => {
    const week = target.weeks.find((row) => row.id === item.weekId);
    const phase = week
      ? target.phases.find((row) => row.id === week.phaseId)
      : undefined;
    return phase?.projectId === localProjectId;
  })) {
    const fingerprint = taskFingerprint(target, localProjectId, task.id);
    if (fingerprint) {
      localMap.set(fingerprint, task.id);
    }
  }

  for (const row of incoming.progress.filter(
    (item) => item.projectId === incomingProjectId
  )) {
    const fingerprint = taskFingerprint(incoming, incomingProjectId, row.taskId);
    if (!fingerprint) continue;

    const localTaskId = localMap.get(fingerprint);
    if (!localTaskId) continue;

    const existing = target.progress.find(
      (item) => item.projectId === localProjectId && item.taskId === localTaskId
    );

    if (!existing || existing.completedAt < row.completedAt) {
      target.progress = target.progress.filter(
        (item) =>
          !(item.projectId === localProjectId && item.taskId === localTaskId)
      );
      target.progress.push({
        projectId: localProjectId,
        taskId: localTaskId,
        completedAt: row.completedAt,
      });
    }
  }
}

export function createSyncBundle(
  data: SyncData,
  source: SyncBundle["source"]
): SyncBundle {
  return {
    version: SYNC_VERSION,
    exportedAt: new Date().toISOString(),
    source,
    data,
  };
}

export function validateSyncBundle(value: unknown): SyncBundle {
  if (!value || typeof value !== "object") {
    throw new Error("Sync file is not valid JSON");
  }

  const bundle = value as Partial<SyncBundle>;
  if (bundle.version !== SYNC_VERSION) {
    throw new Error("Unsupported sync file version");
  }
  if (!bundle.data || typeof bundle.data !== "object") {
    throw new Error("Sync file is missing data");
  }

  const { projects, phases, weeks, tasks, progress } = bundle.data as Partial<SyncData>;
  if (
    !Array.isArray(projects) ||
    !Array.isArray(phases) ||
    !Array.isArray(weeks) ||
    !Array.isArray(tasks) ||
    !Array.isArray(progress)
  ) {
    throw new Error("Sync file is missing project data");
  }

  return bundle as SyncBundle;
}

export function mergeSyncData(
  local: SyncData,
  incoming: SyncData
): { data: SyncData; result: SyncImportResult } {
  const merged: SyncData = {
    projects: local.projects.map((project) => ({ ...project })),
    phases: local.phases.map((phase) => ({ ...phase })),
    weeks: local.weeks.map((week) => ({ ...week })),
    tasks: local.tasks.map((task) => ({ ...task })),
    progress: local.progress.map((row) => ({ ...row })),
  };

  const result: SyncImportResult = { added: 0, updated: 0, skipped: 0 };
  const localBySlug = new Map(merged.projects.map((project) => [project.slug, project]));

  for (const incomingProject of incoming.projects) {
    const localProject = localBySlug.get(incomingProject.slug);

    if (!localProject) {
      appendProject(merged, incomingProject.id, incoming);
      localBySlug.set(incomingProject.slug, incomingProject);
      result.added += 1;
      continue;
    }

    if (incomingProject.updatedAt > localProject.updatedAt) {
      removeProject(merged, localProject.id);
      appendProject(merged, incomingProject.id, incoming);
      localBySlug.set(incomingProject.slug, incomingProject);
      result.updated += 1;
      continue;
    }

    if (incomingProject.updatedAt < localProject.updatedAt) {
      mergeProgressByFingerprint(
        merged,
        localProject.id,
        incoming,
        incomingProject.id
      );
      result.skipped += 1;
      continue;
    }

    mergeProgressByFingerprint(
      merged,
      localProject.id,
      incoming,
      incomingProject.id
    );
    result.updated += 1;
  }

  return { data: merged, result };
}
