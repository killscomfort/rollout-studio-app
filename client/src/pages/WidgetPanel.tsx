import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail, Task } from "../../../shared/types";
import { CATEGORY_LABELS } from "../../../shared/types";
import { api, isSupabaseConfigured, subscribeToCloudChanges } from "../api";
import {
  celebrateTaskComplete,
  markTaskRowCelebrating,
} from "../lib/celebrate-task";
import { WidgetSkyBackground } from "../components/WidgetSkyBackground";

const ACTIVE_PROJECT_KEY = "rollout-active-project-id";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function todayLabel() {
  return DAY_NAMES[new Date().getDay()];
}

function flattenTasks(project: ProjectDetail) {
  return project.phases.flatMap((phase) =>
    phase.weeks.flatMap((week) =>
      week.tasks.map((task) => ({
        ...task,
        phaseTitle: phase.title,
        weekLabel: week.label,
      }))
    )
  );
}

function pickTodayTasks(tasks: ReturnType<typeof flattenTasks>) {
  const today = todayLabel();
  const todays = tasks.filter((task) => task.day === today);
  if (todays.length > 0) {
    return { label: `Today · ${today}`, tasks: todays };
  }

  const next = tasks.find((task) => !task.completed);
  if (next) {
    return { label: "Next up", tasks: [next] };
  }

  return { label: "All caught up", tasks: [] as typeof tasks };
}

export function WidgetPanel() {
  const isNative = Capacitor.isNativePlatform();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(true);

  async function loadProject() {
    setError(null);
    try {
      const projects = await api.listProjects();
      if (projects.length === 0) {
        setProject(null);
        return;
      }

      const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      const preferred =
        projects.find((item) => item.id === savedId) ?? projects[0];
      const detail = await api.getProject(preferred.id);
      if (!detail) {
        setProject(null);
        return;
      }
      localStorage.setItem(ACTIVE_PROJECT_KEY, detail.id);
      setProject(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load widget");
    }
  }

  useEffect(() => {
    void loadProject();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    return subscribeToCloudChanges(() => {
      void loadProject();
    });
  }, []);

  const stats = useMemo(() => {
    if (!project) return { pct: 0, remaining: 0 };
    const remaining = project.totalTasks - project.completedTasks;
    const pct = project.totalTasks
      ? Math.round((project.completedTasks / project.totalTasks) * 100)
      : 0;
    return { pct, remaining };
  }, [project]);

  const today = useMemo(() => {
    if (!project) return { label: "Today", tasks: [] as Task[] };
    return pickTodayTasks(flattenTasks(project));
  }, [project]);

  async function toggleTask(taskId: string, completed: boolean) {
    if (!project) return;
    const next = await api.setTaskCompleted(project.id, taskId, completed);
    setProject(next);
  }

  async function handlePinToggle() {
    if (window.rolloutStudio?.toggleAlwaysOnTop) {
      const next = await window.rolloutStudio.toggleAlwaysOnTop();
      setPinned(next);
    }
  }

  return (
    <div className="widget-shell">
      <WidgetSkyBackground />
      <div className="widget-content">
        <div className="widget-header">
          <div className="widget-drag">
            <div className="widget-kicker">Rollout widget</div>
            <div className="widget-title">{project?.name ?? "Rollout Studio"}</div>
          </div>
          <div className="widget-actions">
            {!isNative ? (
              <>
                <button
                  type="button"
                  className="widget-icon-button"
                  title={pinned ? "Unpin widget" : "Pin widget"}
                  onClick={handlePinToggle}
                >
                  {pinned ? "Pin" : "Float"}
                </button>
                <button
                  type="button"
                  className="widget-icon-button widget-close-button"
                  title="Close widget"
                  aria-label="Close widget"
                  onClick={() => void window.rolloutStudio?.closeWidget?.()}
                >
                  ×
                </button>
              </>
            ) : null}
          </div>
        </div>

      {error ? <div className="widget-error">{error}</div> : null}

      {project ? (
        <div className="widget-body">
          <div className="widget-progress-block">
            <div className="widget-progress-meta">
              <span>{stats.pct}% complete</span>
              <span>{stats.remaining} left</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>

          <div className="widget-section-label">{today.label}</div>
          <div className="widget-task-list">
            {today.tasks.length === 0 ? (
              <div className="widget-empty">Nothing scheduled for today.</div>
            ) : (
              today.tasks.map((task) => (
                <label key={task.id} className="widget-task-row">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={(event) => {
                      const completed = event.target.checked;
                      if (completed) {
                        celebrateTaskComplete(event.currentTarget);
                        markTaskRowCelebrating(event.currentTarget);
                      }
                      void toggleTask(task.id, completed);
                    }}
                  />
                  <span className="widget-task-copy">
                    <span className="widget-task-category">
                      {CATEGORY_LABELS[task.category]}
                    </span>
                    {task.task}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="widget-empty">
          No projects yet. Open the full app to create one.
        </div>
      )}

      {!isNative ? (
        <div className="widget-footer">
          <button
            type="button"
            className="button primary widget-open-full"
            onClick={() =>
              window.rolloutStudio?.openMain(project?.id ?? undefined)
            }
          >
            Open full app
          </button>
        </div>
      ) : null}
      </div>
    </div>
  );
}
