import { useEffect, useState } from "react";
import type { ProjectDetail } from "../../../shared/types";
import { api } from "../api";
import {
  RolloutDashboard,
  type CategoryFilter,
} from "../components/RolloutDashboard";

interface ProjectWorkspaceProps {
  projectId: string;
  onBack: () => void;
  onOpenSettings: () => void;
}

export function ProjectWorkspace({
  projectId,
  onBack,
  onOpenSettings,
}: ProjectWorkspaceProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProject() {
    setLoading(true);
    setError(null);
    try {
      const next = await api.getProject(projectId);
      setProject(next);
      setSelectedPhaseId((current) => current || next.phases[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProject();
  }, [projectId]);

  async function handleToggleTask(taskId: string, completed: boolean) {
    try {
      const next = await api.setTaskCompleted(projectId, taskId, completed);
      setProject(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  if (loading) {
    return <div className="empty-state">Loading rollout…</div>;
  }

  if (error || !project) {
    return (
      <div>
        <div className="top-nav">
          <button type="button" className="button ghost" onClick={onBack}>
            Back to projects
          </button>
        </div>
        <div className="callout">{error ?? "Project not found"}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="top-nav">
        <button type="button" className="button ghost" onClick={onBack}>
          All projects
        </button>
        <button type="button" className="button" onClick={onOpenSettings}>
          Project settings
        </button>
      </div>

      <RolloutDashboard
        project={project}
        selectedPhaseId={selectedPhaseId}
        selectedWeekIndex={selectedWeekIndex}
        categoryFilter={categoryFilter}
        onSelectPhase={(phaseId) => {
          setSelectedPhaseId(phaseId);
          setSelectedWeekIndex(0);
        }}
        onSelectWeek={setSelectedWeekIndex}
        onCategoryFilter={setCategoryFilter}
        onToggleTask={handleToggleTask}
      />
    </div>
  );
}
