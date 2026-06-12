import type {
  Phase,
  PhaseTemplate,
  ProjectDetail,
  ProjectTemplate,
  TaskCategory,
} from "../../../shared/types";

export const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const TASK_CATEGORIES: TaskCategory[] = [
  "content",
  "distribute",
  "playlist",
  "engage",
  "setup",
  "admin",
];

export interface PersonalizationInput {
  trackName: string;
  artistName: string;
  city: string;
  bookingUrl: string;
}

export function projectPhasesToTemplate(phases: Phase[]): PhaseTemplate[] {
  return phases.map(({ title, color, weeks }) => ({
    title,
    color,
    weeks: weeks.map(({ label, subtitle, tasks }) => ({
      label,
      subtitle,
      tasks: tasks.map(({ day, category, task }) => ({
        day,
        category,
        task,
      })),
    })),
  }));
}

export function projectToPlanTemplate(project: ProjectDetail): ProjectTemplate {
  return {
    slug: project.slug,
    name: project.name,
    tagline: project.tagline,
    bookingUrl: project.bookingUrl,
    funnelNote: project.funnelNote,
    phases: projectPhasesToTemplate(project.phases),
  };
}

function replaceInText(text: string, replacements: Array<[string, string]>) {
  let next = text;
  for (const [from, to] of replacements) {
    if (!from || !to) continue;
    next = next.split(from).join(to);
  }
  return next;
}

export function applyPersonalization(
  phases: PhaseTemplate[],
  input: PersonalizationInput
): PhaseTemplate[] {
  const bookingHost = input.bookingUrl
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const replacements: Array<[string, string]> = [
    ["'Your Track Title'", input.trackName ? `'${input.trackName}'` : "'Your Track Title'"],
    ["Your Track Title", input.trackName || "Your Track Title"],
    ["your artist name", input.artistName || "your artist name"],
    ["your city", input.city || "your city"],
    ["your-link.com", bookingHost || "your-link.com"],
  ];

  return phases.map((phase) => ({
    ...phase,
    title: replaceInText(phase.title, replacements),
    weeks: phase.weeks.map((week) => ({
      ...week,
      label: replaceInText(week.label, replacements),
      subtitle: replaceInText(week.subtitle, replacements),
      tasks: week.tasks.map((task) => ({
        ...task,
        task: replaceInText(task.task, replacements),
      })),
    })),
  }));
}

export function clonePhases(phases: PhaseTemplate[]): PhaseTemplate[] {
  return JSON.parse(JSON.stringify(phases)) as PhaseTemplate[];
}
