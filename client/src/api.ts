import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
  ProjectTemplate,
  UpdateProjectInput,
} from "../../shared/types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  listProjects: () => request<ProjectSummary[]>("/api/projects"),
  getProject: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (input: CreateProjectInput) =>
    request<ProjectDetail>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProject: (id: string, input: UpdateProjectInput) =>
    request<ProjectDetail>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  setTaskCompleted: (projectId: string, taskId: string, completed: boolean) =>
    request<ProjectDetail>(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    }),
  replacePlan: (projectId: string, template: ProjectTemplate) =>
    request<ProjectDetail>(`/api/projects/${projectId}/plan`, {
      method: "PUT",
      body: JSON.stringify(template),
    }),
  resetPlan: (projectId: string, templateSlug: string) =>
    request<ProjectDetail>(`/api/projects/${projectId}/plan/reset`, {
      method: "POST",
      body: JSON.stringify({ templateSlug }),
    }),
  listTemplates: () =>
    request<Array<{ slug: string; name: string; tagline: string }>>(
      "/api/projects/templates"
    ),
};
