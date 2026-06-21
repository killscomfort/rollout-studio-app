import { Capacitor } from "@capacitor/core";
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
  ProjectTemplate,
  UpdateProjectInput,
  UpdateTaskInput,
} from "../../shared/types";
import type { SyncBundle, SyncImportResult } from "../../shared/sync";
import { isSupabaseConfigured, useCloudBackend } from "./lib/config";
import * as localDb from "./data/native-store";
import * as cloudDb from "./data/supabase-store";
import { listTemplates as listLocalTemplates } from "./data/templates";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function useCloudData() {
  return useCloudBackend();
}

function useLocalNativeData() {
  return Capacitor.isNativePlatform() && !useCloudData();
}

function localApiHint() {
  return "Start the local app with `npm run dev` so the API is running.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new Error(`Can't reach the local API. ${localApiHint()}`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.error ?? `Request failed (${response.status})`;
    throw new Error(
      response.status >= 500
        ? `${detail}. ${localApiHint()}`
        : detail
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  listProjects: () =>
    useCloudData()
      ? cloudDb.listProjects()
      : useLocalNativeData()
        ? localDb.listProjects()
        : request<ProjectSummary[]>("/api/projects"),
  getProject: (id: string) =>
    useCloudData()
      ? cloudDb.getProject(id)
      : useLocalNativeData()
        ? localDb.getProject(id)
        : request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (input: CreateProjectInput) =>
    useCloudData()
      ? cloudDb.createProjectFromTemplate(input)
      : useLocalNativeData()
        ? localDb.createProjectFromTemplate(input)
        : request<ProjectDetail>("/api/projects", {
            method: "POST",
            body: JSON.stringify(input),
          }),
  updateProject: (id: string, input: UpdateProjectInput) =>
    useCloudData()
      ? cloudDb.updateProject(id, input)
      : useLocalNativeData()
        ? localDb.updateProject(id, input)
        : request<ProjectDetail>(`/api/projects/${id}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          }),
  deleteProject: (id: string) =>
    useCloudData()
      ? cloudDb.deleteProject(id).then(() => undefined)
      : useLocalNativeData()
        ? localDb.deleteProject(id).then(() => undefined)
        : request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  setTaskCompleted: (projectId: string, taskId: string, completed: boolean) =>
    api.updateTask(projectId, taskId, { completed }),
  updateTask: (projectId: string, taskId: string, input: UpdateTaskInput) =>
    useCloudData()
      ? cloudDb.updateTask(projectId, taskId, input).then(async () => {
          const project = await cloudDb.getProject(projectId);
          if (!project) throw new Error("Project not found");
          return project;
        })
      : useLocalNativeData()
        ? localDb.updateTask(projectId, taskId, input).then(async () => {
            const project = await localDb.getProject(projectId);
            if (!project) throw new Error("Project not found");
            return project;
          })
        : request<ProjectDetail>(`/api/projects/${projectId}/tasks/${taskId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          }),
  replacePlan: (projectId: string, template: ProjectTemplate) =>
    useCloudData()
      ? cloudDb.replacePlan(projectId, template)
      : useLocalNativeData()
        ? localDb.replacePlan(projectId, template)
        : request<ProjectDetail>(`/api/projects/${projectId}/plan`, {
            method: "PUT",
            body: JSON.stringify(template),
          }),
  resetPlan: (projectId: string, templateSlug: string) =>
    useCloudData()
      ? cloudDb.resetPlan(projectId, templateSlug)
      : useLocalNativeData()
        ? localDb.resetPlan(projectId, templateSlug)
        : request<ProjectDetail>(`/api/projects/${projectId}/plan/reset`, {
            method: "POST",
            body: JSON.stringify({ templateSlug }),
          }),
  listTemplates: () =>
    useCloudData() || useLocalNativeData()
      ? Promise.resolve(listLocalTemplates())
      : request<Array<{ slug: string; name: string; tagline: string }>>(
          "/api/projects/templates"
        ),
  exportSync: (): Promise<SyncBundle> =>
    useCloudData()
      ? cloudDb.exportSyncBundle()
      : useLocalNativeData()
        ? localDb.exportSyncBundle()
        : request<SyncBundle>("/api/sync/export"),
  importSync: (bundle: SyncBundle): Promise<SyncImportResult> =>
    useCloudData()
      ? cloudDb.importSyncBundle(bundle)
      : useLocalNativeData()
        ? localDb.importSyncBundle(bundle)
        : request<SyncImportResult>("/api/sync/import", {
            method: "POST",
            body: JSON.stringify(bundle),
          }),
};

export async function initAppData() {
  if (useCloudData()) {
    return cloudDb.initSupabaseStore();
  }
  if (useLocalNativeData()) {
    return localDb.initLocalDatabase();
  }
}

export { isSupabaseConfigured, isCloudBackendMisconfigured, useCloudBackend } from "./lib/config";
export { onAuthStateChange } from "./data/supabase-store";
export { subscribeToCloudChanges } from "./lib/cloud-sync";
