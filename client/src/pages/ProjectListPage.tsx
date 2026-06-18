import { useEffect, useState } from "react";
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
  UpdateTaskInput,
} from "../../../shared/types";
import { DEFAULT_TEMPLATE_SLUG } from "../../../shared/template-personalize";
import {
  RolloutDashboard,
  type CategoryFilter,
} from "../components/RolloutDashboard";
import { SyncControls } from "../components/SyncControls";
import { AccountControls } from "../components/AccountControls";
import { AppFooter } from "../components/AppFooter";
import { pickContinueProject } from "../lib/active-project";
import { useCloudBackend } from "../api";
import { api } from "../api";

interface ProjectListPageProps {
  onOpenProject: (projectId: string) => void;
}

export function ProjectListPage({ onOpenProject }: ProjectListPageProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [continueProject, setContinueProject] = useState<ProjectDetail | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function loadContinueProject(summary: ProjectSummary | null) {
    if (!summary) {
      setContinueProject(null);
      return;
    }

    const detail = await api.getProject(summary.id);
    setContinueProject(detail);
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const projectList = await api.listProjects();
      setProjects(projectList);
      await loadContinueProject(pickContinueProject(projectList));
    } catch (err) {
      setContinueProject(null);
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    const input: CreateProjectInput = {
      name: name.trim(),
      templateSlug: DEFAULT_TEMPLATE_SLUG,
    };

    try {
      const project = await api.createProject(input);
      setName("");
      await refresh();
      onOpenProject(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  async function handleToggleTask(taskId: string, completed: boolean) {
    if (!continueProject) return;
    try {
      const next = await api.setTaskCompleted(continueProject.id, taskId, completed);
      setContinueProject(next);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleUpdateTask(taskId: string, input: UpdateTaskInput) {
    if (!continueProject) return;
    const next = await api.updateTask(continueProject.id, taskId, input);
    setContinueProject(next);
    const projectList = await api.listProjects();
    setProjects(projectList);
  }

  const otherProjects = continueProject
    ? projects.filter((project) => project.id !== continueProject.id)
    : projects;

  const continuePct = continueProject?.totalTasks
    ? Math.round(
        (continueProject.completedTasks / continueProject.totalTasks) * 100
      )
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rollout Studio</h1>
          <p className="page-subtitle">
            Rollout checklists for Mac and iPhone — one workspace per release.
          </p>
        </div>
        <div className="page-header-actions">
          {useCloudBackend() ? <AccountControls /> : null}
        </div>
      </div>

      {error ? (
        <div className="callout error">
          <strong>Couldn&apos;t load projects.</strong> {error}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button type="button" className="button" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !error && projects.length === 0 && useCloudBackend() ? (
        <div className="callout on-sky" style={{ marginBottom: 24 }}>
          <strong>No cloud projects yet.</strong> Your FuckDaHaters progress may still
          be on this Mac&apos;s local database. Run <code>npm run dev</code> for local
          mode, or export a sync file on the Mac and import it below.
        </div>
      ) : null}

      {!loading && !error && continueProject ? (
        <section className="continue-release panel-card">
          <div className="continue-release-header">
            <div>
              <p className="continue-release-kicker">Current release</p>
              <h2 className="continue-release-title">{continueProject.name}</h2>
              <p className="continue-release-subtitle">{continueProject.tagline}</p>
              <p className="continue-release-progress">
                {continueProject.completedTasks}/{continueProject.totalTasks} tasks
                complete · {continuePct}%
                {continueProject.releaseDate
                  ? ` · Release ${continueProject.releaseDate}`
                  : ""}
              </p>
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="button"
                onClick={() => onOpenProject(continueProject.id)}
              >
                Open full workspace
              </button>
            </div>
          </div>
          <RolloutDashboard
            project={continueProject}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            onToggleTask={(taskId, completed) => void handleToggleTask(taskId, completed)}
            onUpdateTask={handleUpdateTask}
          />
        </section>
      ) : null}

      <SyncControls onSynced={() => void refresh()} />

      <div className="panel-card" style={{ marginBottom: 24 }}>
        <h2 className="section-title">Create project</h2>
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Project name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My next single rollout"
            />
          </label>
          <div className="toolbar">
            <button type="submit" className="button primary">
              Create project
            </button>
          </div>
        </form>
      </div>

      {otherProjects.length > 0 ? (
        <>
          <h2 className="section-title sky-heading">Other projects</h2>
          <div className="project-grid">
            {otherProjects.map((project) => {
              const pct = project.totalTasks
                ? Math.round((project.completedTasks / project.totalTasks) * 100)
                : 0;
              return (
                <button
                  key={project.id}
                  type="button"
                  className="project-card"
                  onClick={() => onOpenProject(project.id)}
                  style={{ textAlign: "left" }}
                >
                  <h3>{project.name}</h3>
                  <p>{project.tagline}</p>
                  <p style={{ marginTop: 10 }}>
                    {project.completedTasks}/{project.totalTasks} tasks · {pct}%
                  </p>
                </button>
              );
            })}
          </div>
        </>
      ) : loading ? (
        <div className="empty-state">Loading projects…</div>
      ) : !error && !continueProject ? (
        <div className="empty-state">No projects yet. Create one above.</div>
      ) : null}

      <AppFooter />
    </div>
  );
}
