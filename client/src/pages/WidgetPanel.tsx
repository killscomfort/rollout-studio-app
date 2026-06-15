import { Capacitor } from "@capacitor/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ProjectDetail } from "../../../shared/types";
import { CATEGORY_LABELS } from "../../../shared/types";
import { api, isSupabaseConfigured, subscribeToCloudChanges } from "../api";
import {
  celebrateTaskComplete,
  TASK_CELEBRATION_MS,
} from "../lib/celebrate-task";
import { WidgetSkyBackground } from "../components/WidgetSkyBackground";

const ACTIVE_PROJECT_KEY = "rollout-active-project-id";
const UNDO_WINDOW_MS = 8000;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function todayLabel() {
  return DAY_NAMES[new Date().getDay()];
}

function truncateLabel(text: string, max = 48) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
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

export function WidgetPanel() {
  const isNative = Capacitor.isNativePlatform();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(true);
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [undoPrompt, setUndoPrompt] = useState<{ taskId: string; label: string } | null>(
    null
  );
  const undoTimeoutRef = useRef<number | null>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const pendingScrollTopRef = useRef<number | null>(null);

  function clearUndoTimeout() {
    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }

  function dismissUndoPrompt() {
    clearUndoTimeout();
    setUndoPrompt(null);
  }

  function showUndoPrompt(taskId: string, label: string) {
    clearUndoTimeout();
    setUndoPrompt({ taskId, label });
    undoTimeoutRef.current = window.setTimeout(() => {
      undoTimeoutRef.current = null;
      setUndoPrompt((current) => (current?.taskId === taskId ? null : current));
    }, UNDO_WINDOW_MS);
  }

  useEffect(() => {
    return () => clearUndoTimeout();
  }, []);

  useLayoutEffect(() => {
    if (pendingScrollTopRef.current === null || !taskListRef.current) return;
    const top = pendingScrollTopRef.current;
    pendingScrollTopRef.current = null;
    taskListRef.current.scrollTop = top;
  }, [project, undoPrompt]);

  function rememberTaskListScroll() {
    pendingScrollTopRef.current = taskListRef.current?.scrollTop ?? 0;
  }

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
    if (!project) return { pct: 0, remaining: 0, completed: 0 };
    const remaining = project.totalTasks - project.completedTasks;
    const pct = project.totalTasks
      ? Math.round((project.completedTasks / project.totalTasks) * 100)
      : 0;
    return { pct, remaining, completed: project.completedTasks };
  }, [project]);

  const widgetTasks = useMemo(() => {
    if (!project) return [];
    return flattenTasks(project);
  }, [project]);

  const today = todayLabel();

  async function toggleTask(taskId: string, completed: boolean) {
    if (!project) return;

    if (!completed && undoPrompt?.taskId === taskId) {
      dismissUndoPrompt();
    }

    rememberTaskListScroll();

    setProject((current) => {
      if (!current) return current;
      return {
        ...current,
        completedTasks: completed
          ? current.completedTasks + 1
          : Math.max(0, current.completedTasks - 1),
        phases: current.phases.map((phase) => ({
          ...phase,
          weeks: phase.weeks.map((week) => ({
            ...week,
            tasks: week.tasks.map((task) =>
              task.id === taskId ? { ...task, completed } : task
            ),
          })),
        })),
      };
    });

    setSavingTaskId(taskId);
    try {
      const next = await api.setTaskCompleted(project.id, taskId, completed);
      setProject(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
      void loadProject();
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleUndoComplete() {
    if (!undoPrompt) return;
    const { taskId } = undoPrompt;
    dismissUndoPrompt();
    setCelebratingTaskId((current) => (current === taskId ? null : current));
    await toggleTask(taskId, false);
  }

  function scrollToFirstCompleted() {
    const firstCompleted = widgetTasks.find((task) => task.completed);
    if (!firstCompleted || !taskListRef.current) return;
    const row = taskListRef.current.querySelector(
      `[data-task-id="${firstCompleted.id}"]`
    );
    row?.scrollIntoView({ behavior: "smooth", block: "start" });
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

        {undoPrompt ? (
          <div className="widget-undo-bar" role="status" aria-live="polite">
            <span className="widget-undo-text" title={undoPrompt.label}>
              Marked done: {truncateLabel(undoPrompt.label)}
            </span>
            <button
              type="button"
              className="widget-undo-button"
              aria-label={`Undo marking "${undoPrompt.label}" as done`}
              onClick={() => void handleUndoComplete()}
            >
              Undo
            </button>
          </div>
        ) : null}

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

            <div className="widget-section-label">
              <span>All tasks · Today is {today}</span>
              {stats.completed > 0 ? (
                <button
                  type="button"
                  className="widget-scroll-completed"
                  onClick={scrollToFirstCompleted}
                >
                  ↑ {stats.completed} done
                </button>
              ) : null}
            </div>
            <div className="widget-task-list" ref={taskListRef}>
              {widgetTasks.length === 0 ? (
                <div className="widget-empty">No tasks in this rollout yet.</div>
              ) : (
                widgetTasks.map((task) => (
                  <label
                    key={task.id}
                    data-task-id={task.id}
                    className={[
                      "widget-task-row",
                      task.completed ? "done" : "",
                      task.day === today ? "widget-task-today" : "",
                      celebratingTaskId === task.id ? "task-complete-celebrate" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      disabled={savingTaskId === task.id}
                      onChange={(event) => {
                        const completed = event.target.checked;
                        if (completed) {
                          celebrateTaskComplete(event.currentTarget);
                          setCelebratingTaskId(task.id);
                          window.setTimeout(
                            () =>
                              setCelebratingTaskId((current) =>
                                current === task.id ? null : current
                              ),
                            TASK_CELEBRATION_MS
                          );
                          showUndoPrompt(task.id, task.task);
                        } else if (undoPrompt?.taskId === task.id) {
                          dismissUndoPrompt();
                        }
                        void toggleTask(task.id, completed);
                      }}
                    />
                    <span className="widget-task-copy">
                      <span className="widget-task-category">
                        {task.day} · {CATEGORY_LABELS[task.category]}
                      </span>
                      {task.task}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="widget-empty widget-body">
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
