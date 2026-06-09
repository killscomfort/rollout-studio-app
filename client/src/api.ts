import { Capacitor } from "@capacitor/core";
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
  ProjectTemplate,
  UpdateProjectInput,
} from "../../shared/types";
import type { SyncBundle, SyncImportResult } from "../../shared/sync";
import * as localDb from "./data/native-store";
import { listTemplates as listLocalTemplates } from "./data/templates";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const useLocalData = () => Capacitor.isNativePlatform();

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
  listProjects: () =>
    useLocalData()
      ? localDb.listProjects()
      : request<ProjectSummary[]>("/api/projects"),
  getProject: (id: string) =>
    useLocalData()
      ? localDb.getProject(id)
      : request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (input: CreateProjectInput) =>
    useLocalData()
      ? localDb.createProjectFromTemplate(input)
      : request<ProjectDetail>("/api/projects", {
          method: "POST",
          body: JSON.stringify(input),
        }),
  updateProject: (id: string, input: UpdateProjectInput) =>
    useLocalData()
      ? localDb.updateProject(id, input)
      : request<ProjectDetail>(`/api/projects/${id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
  deleteProject: (id: string) =>
    useLocalData()
      ? localDb.deleteProject(id).then(() => undefined)
      : request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  setTaskCompleted: (projectId: string, taskId: string, completed: boolean) =>
    useLocalData()
      ? localDb.setTaskCompleted(projectId, taskId, completed).then(async () => {
          const project = await localDb.getProject(projectId);
          if (!project) {
            throw new Error("Project not found");
          }
          return project;
        })
      : request<ProjectDetail>(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify({ completed }),
        }),
  replacePlan: (projectId: string, template: ProjectTemplate) =>
    useLocalData()
      ? localDb.replacePlan(projectId, template)
      : request<ProjectDetail>(`/api/projects/${projectId}/plan`, {
          method: "PUT",
          body: JSON.stringify(template),
        }),
  resetPlan: (projectId: string, templateSlug: string) =>
    useLocalData()
      ? localDb.resetPlan(projectId, templateSlug)
      : request<ProjectDetail>(`/api/projects/${projectId}/plan/reset`, {
          method: "POST",
          body: JSON.stringify({ templateSlug }),
        }),
  listTemplates: () =>
    useLocalData()
      ? Promise.resolve(listLocalTemplates())
      : request<Array<{ slug: string; name: string; tagline: string }>>(
          "/api/projects/templates"
        ),
  exportSync: (): Promise<SyncBundle> =>
    useLocalData()
      ? localDb.exportSyncBundle()
      : request<SyncBundle>("/api/sync/export"),
  importSync: (bundle: SyncBundle): Promise<SyncImportResult> =>
    useLocalData()
      ? localDb.importSyncBundle(bundle)
      : request<SyncImportResult>("/api/sync/import", {
          method: "POST",
          body: JSON.stringify(bundle),
        }),
};

export { initLocalDatabase } from "./data/native-store";
