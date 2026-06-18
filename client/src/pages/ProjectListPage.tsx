import { useEffect, useState } from "react";
import type { CreateProjectInput, ProjectSummary } from "../../../shared/types";
import { DEFAULT_TEMPLATE_SLUG } from "../../../shared/template-personalize";
import { SyncControls } from "../components/SyncControls";
import { AccountControls } from "../components/AccountControls";
import { AppFooter } from "../components/AppFooter";
import { useCloudBackend } from "../api";
import { api } from "../api";

interface ProjectListPageProps {
  onOpenProject: (projectId: string) => void;
}

export function ProjectListPage({ onOpenProject }: ProjectListPageProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
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

      <h2 className="section-title sky-heading">Your projects</h2>
      {loading ? (
        <div className="empty-state">Loading projects…</div>
      ) : error ? null : projects.length === 0 ? (
        <div className="empty-state">No projects yet. Create one above.</div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => {
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
      )}
      <AppFooter />
    </div>
  );
}
