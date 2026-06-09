import { useEffect, useState } from "react";
import type { ProjectDetail } from "../../../shared/types";
import { api } from "../api";

interface ProjectSettingsPageProps {
  projectId: string;
  onBack: () => void;
  onSaved: () => void;
}

export function ProjectSettingsPage({
  projectId,
  onBack,
  onSaved,
}: ProjectSettingsPageProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [funnelNote, setFunnelNote] = useState("");
  const [planJson, setPlanJson] = useState("");
  const [templateSlug, setTemplateSlug] = useState("blank");
  const [templates, setTemplates] = useState<
    Array<{ slug: string; name: string; tagline: string }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [loaded, templateList] = await Promise.all([
          api.getProject(projectId),
          api.listTemplates(),
        ]);
        setProject(loaded);
        setName(loaded.name);
        setTagline(loaded.tagline);
        setBookingUrl(loaded.bookingUrl);
        setFunnelNote(loaded.funnelNote);
        setPlanJson(
          JSON.stringify(
            {
              slug: loaded.slug,
              name: loaded.name,
              tagline: loaded.tagline,
              bookingUrl: loaded.bookingUrl,
              funnelNote: loaded.funnelNote,
              phases: loaded.phases.map(({ title, color, weeks }) => ({
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
              })),
            },
            null,
            2
          )
        );
        setTemplates(templateList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      }
    })();
  }, [projectId]);

  async function saveMeta(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await api.updateProject(projectId, {
        name,
        tagline,
        bookingUrl,
        funnelNote,
      });
      setMessage("Project settings saved.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  async function importPlan() {
    setMessage(null);
    setError(null);
    try {
      const parsed = JSON.parse(planJson);
      await api.replacePlan(projectId, parsed);
      setMessage("Plan imported successfully.");
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid plan JSON or import failed"
      );
    }
  }

  async function resetPlan() {
    setMessage(null);
    setError(null);
    try {
      await api.resetPlan(projectId, templateSlug);
      setMessage(`Plan reset from ${templateSlug} template.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset plan");
    }
  }

  async function deleteProject() {
    if (!project) return;
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      return;
    }
    await api.deleteProject(projectId);
    onBack();
  }

  if (!project) {
    return <div className="empty-state">Loading settings…</div>;
  }

  return (
    <div>
      <div className="top-nav">
        <button type="button" className="button ghost" onClick={onBack}>
          Back to rollout
        </button>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Project settings</h1>
          <p className="page-subtitle">{project.name}</p>
        </div>
      </div>

      {message ? <div className="callout">{message}</div> : null}
      {error ? <div className="callout">{error}</div> : null}

      <div className="panel-card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Front-end branding</h2>
        <form className="form-grid" onSubmit={saveMeta}>
          <label>
            Project name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Tagline
            <input
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
            />
          </label>
          <label>
            Booking / landing URL
            <input
              value={bookingUrl}
              onChange={(event) => setBookingUrl(event.target.value)}
              placeholder="https://your-site.com/book"
            />
          </label>
          <label>
            Funnel note
            <textarea
              value={funnelNote}
              onChange={(event) => setFunnelNote(event.target.value)}
            />
          </label>
          <div className="toolbar">
            <button type="submit" className="button primary">
              Save settings
            </button>
          </div>
        </form>
      </div>

      <div className="panel-card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Back-end plan customization</h2>
        <p className="page-subtitle" style={{ marginBottom: 14 }}>
          Edit the JSON plan below to customize phases, weeks, and tasks per
          project. Import replaces the current schedule.
        </p>
        <textarea
          value={planJson}
          onChange={(event) => setPlanJson(event.target.value)}
          style={{ width: "100%", minHeight: 360, fontFamily: "monospace" }}
        />
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button type="button" className="button primary" onClick={importPlan}>
            Import plan JSON
          </button>
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Reset from template</h2>
        <div className="form-grid">
          <label>
            Template
            <select
              value={templateSlug}
              onChange={(event) => setTemplateSlug(event.target.value)}
            >
              {templates.map((template) => (
                <option key={template.slug} value={template.slug}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <div className="toolbar">
            <button type="button" className="button" onClick={resetPlan}>
              Reset plan
            </button>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <h2 className="section-title">Danger zone</h2>
        <button type="button" className="button danger" onClick={deleteProject}>
          Delete project
        </button>
      </div>
    </div>
  );
}
