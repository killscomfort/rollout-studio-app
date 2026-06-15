import { useEffect, useState } from "react";
import type { ProjectDetail, UpdateTaskInput } from "../../../shared/types";
import { api } from "../api";
import {
  RolloutDashboard,
  type CategoryFilter,
} from "../components/RolloutDashboard";

interface ProjectWorkspaceProps {
  projectId: string;
  onProjectLoaded: (project: ProjectDetail) => void;
}

export function ProjectWorkspace({
  projectId,
  onProjectLoaded,
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
      if (!next) {
        setError("Project not found");
        return;
      }
      setProject(next);
      onProjectLoaded(next);
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
      onProjectLoaded(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleUpdateTask(taskId: string, input: UpdateTaskInput) {
    try {
      const next = await api.updateTask(projectId, taskId, input);
      setProject(next);
      onProjectLoaded(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
      throw err;
    }
  }

  if (loading) {
    return <div className="empty-state">Loading rollout…</div>;
  }

  if (error || !project) {
    return <div className="callout">{error ?? "Project not found"}</div>;
  }

  return (
    <div>
      {error ? <div className="callout">{error}</div> : null}
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
        onUpdateTask={handleUpdateTask}
      />
    </div>
  );
}
