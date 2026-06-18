import type {
  Phase,
  PhaseTemplate,
  ProjectDetail,
  ProjectTemplate,
  TaskCategory,
} from "../../../shared/types";
import {
  personalizeTemplate,
  type TemplatePersonalization,
} from "../../../shared/template-personalize";

export const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const TASK_CATEGORIES: TaskCategory[] = [
  "content",
  "distribute",
  "playlist",
  "engage",
  "setup",
  "admin",
];

export type PersonalizationInput = TemplatePersonalization;

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

export function applyPersonalization(
  phases: PhaseTemplate[],
  input: PersonalizationInput
): PhaseTemplate[] {
  return personalizeTemplate(
    {
      slug: "",
      name: "",
      tagline: "",
      bookingUrl: input.bookingUrl ?? "",
      funnelNote: "",
      phases,
    },
    input
  ).phases;
}

export function clonePhases(phases: PhaseTemplate[]): PhaseTemplate[] {
  return JSON.parse(JSON.stringify(phases)) as PhaseTemplate[];
}
