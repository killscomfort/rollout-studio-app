import type { ProjectTemplate } from "../../../shared/types";
import fuckdahaters from "../../../shared/seed/fuckdahaters.json";
import singleRelease from "../../../shared/seed/single-release.json";

export const BLANK_TEMPLATE: ProjectTemplate = {
  slug: "blank",
  name: "New Rollout",
  tagline: "Custom release schedule",
  bookingUrl: "",
  funnelNote: "Define your funnel: discovery → listen → convert.",
  phases: [
    {
      title: "Phase 1 — Foundation",
      color: "blue",
      weeks: [
        {
          label: "Week 1",
          subtitle: "Set up distribution and assets",
          tasks: [
            {
              day: "Mon",
              category: "admin",
              task: "Pick your release date and write it everywhere.",
            },
            {
              day: "Tue",
              category: "distribute",
              task: "Upload your track to your distributor with final artwork.",
            },
            {
              day: "Wed",
              category: "setup",
              task: "Update bios and link to your booking or landing page.",
            },
          ],
        },
      ],
    },
  ],
};

export const TEMPLATES: Record<string, ProjectTemplate> = {
  blank: BLANK_TEMPLATE,
  fuckdahaters: fuckdahaters as ProjectTemplate,
  "single-release": singleRelease as ProjectTemplate,
};

export function listTemplates() {
  return Object.values(TEMPLATES).map(({ slug, name, tagline }) => ({
    slug,
    name,
    tagline,
  }));
}
