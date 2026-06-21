import type {
  Phase,
  PhaseColor,
  ProjectDetail,
  ProjectSummary,
  Task,
  TaskCategory,
  Week,
} from "./types";
import type { SyncData } from "./sync";
import { parseGrowthData } from "./growth/store";

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
    releaseDate: project.releaseDate ?? null,
    notificationSchedule: project.notificationSchedule ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    totalTasks,
    completedTasks,
  };
}

/** Build a full project tree (with completion state) from flat Supabase sync rows. */
export function buildProjectDetailFromSync(
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

  return {
    ...mapSummary(project, data),
    phases,
    growthData: project.growthData ?? parseGrowthData(null),
  };
}
