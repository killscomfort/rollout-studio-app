import type { PhaseTemplate, ProjectTemplate } from "./types";

export const DEFAULT_TEMPLATE_SLUG = "fuckdahaters";

export interface TemplatePersonalization {
  trackName?: string;
  artistName?: string;
  city?: string;
  bookingUrl?: string;
}

function replaceInText(text: string, replacements: Array<[string, string]>) {
  let next = text;
  for (const [from, to] of replacements) {
    if (!from || !to) continue;
    next = next.split(from).join(to);
  }
  return next;
}

function personalizePhases(
  phases: PhaseTemplate[],
  input: TemplatePersonalization
): PhaseTemplate[] {
  const trackName = input.trackName?.trim() || "";
  const artistName = input.artistName?.trim() || "";
  const city = input.city?.trim() || "";
  const bookingUrl = input.bookingUrl?.trim() || "";
  const bookingHost = bookingUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const replacements: Array<[string, string]> = [
    ["'FuckDaHaters'", trackName ? `'${trackName}'` : "'FuckDaHaters'"],
    ["FuckDaHaters", trackName || "FuckDaHaters"],
    ["'Your Track Title'", trackName ? `'${trackName}'` : "'Your Track Title'"],
    ["Your Track Title", trackName || "Your Track Title"],
    ["your artist name", artistName || "your artist name"],
    ["your city", city || "your city"],
    ["killscomfort.com/book", bookingHost || "killscomfort.com/book"],
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

export function personalizeTemplate(
  template: ProjectTemplate,
  input: TemplatePersonalization
): ProjectTemplate {
  const bookingUrl = input.bookingUrl?.trim() || template.bookingUrl;

  return {
    ...template,
    bookingUrl,
    phases: personalizePhases(template.phases, {
      ...input,
      bookingUrl,
    }),
  };
}

export function personalizeTemplateForNewProject(
  template: ProjectTemplate,
  projectName: string,
  bookingUrl?: string
): ProjectTemplate {
  return personalizeTemplate(template, {
    trackName: projectName,
    bookingUrl: bookingUrl ?? template.bookingUrl,
  });
}

export function countTemplateWeeks(template: ProjectTemplate): number {
  return template.phases.reduce((sum, phase) => sum + phase.weeks.length, 0);
}
