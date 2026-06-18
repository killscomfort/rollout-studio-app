import type { ProjectSummary } from "../../../shared/types";
import { DEFAULT_TEMPLATE_SLUG } from "../../../shared/template-personalize";

export const ACTIVE_PROJECT_KEY = "rollout-active-project-id";

export function pickContinueProject(
  projects: ProjectSummary[]
): ProjectSummary | null {
  if (projects.length === 0) return null;

  const bySlug = projects.find((project) => project.slug === DEFAULT_TEMPLATE_SLUG);
  if (bySlug) return bySlug;

  const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
  if (savedId) {
    const saved = projects.find((project) => project.id === savedId);
    if (saved) return saved;
  }

  return [...projects].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )[0];
}
