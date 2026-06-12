import { useEffect, useState } from "react";
import type { ProjectDetail, ProjectTemplate } from "../../../shared/types";
import { PlanEditor } from "../components/PlanEditor";
import { api } from "../api";

interface ProjectSettingsPageProps {
  projectId: string;
  onBack: () => void;
  onPlanChanged: () => void;
  onDeleted: () => void;
}

async function reloadProject(projectId: string) {
  const loaded = await api.getProject(projectId);
  if (!loaded) {
    throw new Error("Project not found");
  }
  return loaded;
}

export function ProjectSettingsPage({
  projectId,
  onBack,
  onPlanChanged,
  onDeleted,
}: ProjectSettingsPageProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [funnelNote, setFunnelNote] = useState("");
  const [templateSlug, setTemplateSlug] = useState("blank");
  const [templates, setTemplates] = useState<
    Array<{ slug: string; name: string; tagline: string }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const [loaded, templateList] = await Promise.all([
          reloadProject(projectId),
          api.listTemplates(),
        ]);
        setProject(loaded);
        setName(loaded.name);
        setTagline(loaded.tagline);
        setBookingUrl(loaded.bookingUrl);
        setFunnelNote(loaded.funnelNote);
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
      const updated = await api.updateProject(projectId, {
        name,
        tagline,
        bookingUrl,
        funnelNote,
      });
      if (!updated) {
        throw new Error("Project not found");
      }
      setProject(updated);
      setName(updated.name);
      setMessage("Project settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  async function savePlan(template: ProjectTemplate) {
    setMessage(null);
    setError(null);
    if (
      !window.confirm(
        "Save this plan? Your schedule will update and all checked tasks will reset."
      )
    ) {
      return;
    }
    await api.replacePlan(projectId, template);
    const loaded = await reloadProject(projectId);
    setProject(loaded);
    setName(loaded.name);
    setTagline(loaded.tagline);
    setBookingUrl(loaded.bookingUrl);
    setFunnelNote(loaded.funnelNote);
    setEditorKey((value) => value + 1);
    setMessage("Plan saved.");
    onPlanChanged();
  }

  async function resetPlan() {
    setMessage(null);
    setError(null);
    if (
      !window.confirm(
        "Reset the plan from this template? All checked tasks will be cleared."
      )
    ) {
      return;
    }
    try {
      const updated = await api.resetPlan(projectId, templateSlug);
      setProject(updated);
      setName(updated.name);
      setTagline(updated.tagline);
      setBookingUrl(updated.bookingUrl);
      setFunnelNote(updated.funnelNote);
      setEditorKey((value) => value + 1);
      setMessage(`Plan reset from ${templateSlug} template.`);
      onPlanChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset plan");
    }
  }

  async function deleteProject() {
    if (!project) return;
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteProject(projectId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
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
          <p className="page-subtitle">{name}</p>
        </div>
      </div>

      {message ? <div className="callout success">{message}</div> : null}
      {error ? <div className="callout">{error}</div> : null}

      <div className="panel-card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Project branding</h2>
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
              Save branding
            </button>
          </div>
        </form>
      </div>

      <div className="panel-card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Rollout plan</h2>
        <PlanEditor
          key={editorKey}
          project={project}
          onSave={savePlan}
          onError={setError}
        />
      </div>

      <div className="panel-card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Reset from template</h2>
        <p className="page-subtitle" style={{ marginBottom: 12 }}>
          Start over from a template. Branding fields above are kept; tasks and
          progress are replaced.
        </p>
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
            <button type="button" className="button" onClick={() => void resetPlan()}>
              Reset plan
            </button>
          </div>
        </div>
      </div>

      <div className="panel-card">
        <h2 className="section-title">Danger zone</h2>
        <button type="button" className="button danger" onClick={() => void deleteProject()}>
          Delete project
        </button>
      </div>
    </div>
  );
}
