import { useState } from "react";
import type { Phase, ProjectDetail, Task, TaskCategory, UpdateTaskInput } from "../../../shared/types";
import {
  CATEGORY_LABELS,
  PHASE_COLORS,
} from "../../../shared/types";
import {
  celebrateTaskComplete,
  TASK_CELEBRATION_MS,
} from "../lib/celebrate-task";
import {
  DAY_OPTIONS,
  TASK_CATEGORIES,
} from "../lib/plan-utils";

type CategoryFilter = "all" | TaskCategory;

interface RolloutDashboardProps {
  project: ProjectDetail;
  categoryFilter: CategoryFilter;
  onCategoryFilter: (filter: CategoryFilter) => void;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onUpdateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
}

function phaseProgress(phase: Phase) {
  const total = phase.weeks.reduce((sum, week) => sum + week.tasks.length, 0);
  const done = phase.weeks.reduce(
    (sum, week) => sum + week.tasks.filter((task) => task.completed).length,
    0
  );
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

function taskMatchesFilter(task: Task, filter: CategoryFilter) {
  return filter === "all" || task.category === filter;
}

interface TaskRowProps {
  task: Task;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onUpdateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
}

function TaskRow({ task, onToggleTask, onUpdateTask }: TaskRowProps) {
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDay, setEditDay] = useState(task.day);
  const [editCategory, setEditCategory] = useState(task.category);
  const [editTask, setEditTask] = useState(task.task);
  const [saving, setSaving] = useState(false);

  async function saveEditing() {
    if (!editTask.trim()) return;
    setSaving(true);
    try {
      await onUpdateTask(task.id, {
        day: editDay,
        category: editCategory,
        task: editTask.trim(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setEditDay(task.day);
    setEditCategory(task.category);
    setEditTask(task.task);
    setEditing(true);
  }

  if (editing) {
    return (
      <li className="todo-row todo-row-editing">
        <div className="todo-edit-grid">
          <label>
            Day
            <select
              className="task-inline-select"
              value={editDay}
              onChange={(event) => setEditDay(event.target.value)}
            >
              {DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              className="task-inline-select"
              value={editCategory}
              onChange={(event) =>
                setEditCategory(event.target.value as TaskCategory)
              }
            >
              {TASK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="todo-edit-task">
            Task
            <textarea
              className="task-inline-textarea"
              value={editTask}
              onChange={(event) => setEditTask(event.target.value)}
              rows={3}
            />
          </label>
          <div className="todo-edit-actions">
            <button
              type="button"
              className="button primary"
              disabled={saving || !editTask.trim()}
              onClick={() => void saveEditing()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="button ghost"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className={[
        "todo-row",
        task.completed ? "done" : "",
        celebratingTaskId === task.id ? "task-complete-celebrate" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label className="todo-row-main">
        <input
          type="checkbox"
          checked={task.completed}
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
            }
            onToggleTask(task.id, completed);
          }}
        />
        <span className="todo-row-copy">
          <span className="todo-row-meta">
            [{task.day}] {CATEGORY_LABELS[task.category]}
          </span>
          {task.task}
        </span>
      </label>
      <button
        type="button"
        className="button ghost todo-edit-button"
        onClick={startEditing}
      >
        Edit
      </button>
    </li>
  );
}

export function RolloutDashboard({
  project,
  categoryFilter,
  onCategoryFilter,
  onToggleTask,
  onUpdateTask,
}: RolloutDashboardProps) {
  const pct = project.totalTasks
    ? Math.round((project.completedTasks / project.totalTasks) * 100)
    : 0;

  return (
    <div className="checklist-shell">
      <header className="checklist-header">
        <div>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">
            {project.tagline}
            {project.bookingUrl ? (
              <>
                {" "}
                ·{" "}
                <a href={project.bookingUrl} target="_blank" rel="noreferrer">
                  {project.bookingUrl.replace(/^https?:\/\//, "")}
                </a>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <div className="stat-value">{project.totalTasks}</div>
          <div className="stat-label">Tasks</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-value">{project.completedTasks}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pct}%</div>
          <div className="stat-label">Progress</div>
        </div>
      </div>

      <div className="checklist-progress-block">
        <div className="checklist-progress-meta">
          <span>Overall completion</span>
          <span>
            {project.completedTasks}/{project.totalTasks}
          </span>
        </div>
        <div className="progress-track progress-track-lg">
          <div className="progress-fill progress-fill-success" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="checklist-toolbar">
        <span className="checklist-toolbar-label">Filter</span>
        <div className="pill-row">
          <button
            type="button"
            className={`pill ${categoryFilter === "all" ? "active" : ""}`}
            onClick={() => onCategoryFilter("all")}
          >
            All
          </button>
          {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`pill ${categoryFilter === cat ? "active" : ""}`}
              onClick={() => onCategoryFilter(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="phase-accordion-list">
        {project.phases.map((phase, phaseIndex) => {
          const stats = phaseProgress(phase);
          const visibleWeeks = phase.weeks
            .map((week) => ({
              ...week,
              tasks: week.tasks.filter((task) => taskMatchesFilter(task, categoryFilter)),
            }))
            .filter((week) => week.tasks.length > 0);

          if (visibleWeeks.length === 0 && categoryFilter !== "all") {
            return null;
          }

          return (
            <details
              key={phase.id}
              className="phase-accordion panel-card"
              open={phaseIndex === 0}
            >
              <summary className="phase-accordion-summary">
                <span
                  className="swatch phase-accordion-swatch"
                  style={{ background: PHASE_COLORS[phase.color] }}
                />
                <span className="phase-accordion-title">{phase.title}</span>
                <span className="phase-accordion-count">{stats.total} tasks</span>
                <span className="phase-accordion-progress">
                  {stats.done}/{stats.total} complete
                </span>
              </summary>

              <div className="phase-accordion-body">
                {visibleWeeks.length === 0 ? (
                  <p className="empty-state">No tasks in this phase yet.</p>
                ) : (
                  visibleWeeks.map((week) => (
                    <section key={week.id} className="week-block">
                      <div className="week-block-header">
                        <h3 className="week-block-label">{week.label}</h3>
                        <p className="week-block-subtitle">{week.subtitle}</p>
                      </div>
                      <ul className="todo-list">
                        {week.tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onToggleTask={onToggleTask}
                            onUpdateTask={onUpdateTask}
                          />
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            </details>
          );
        })}
      </div>

      <p className="checklist-footer">
        {project.funnelNote}
      </p>
      <p className="checklist-footer-meta">
        Rollout Studio · {project.slug} · {project.totalTasks} tasks
      </p>
    </div>
  );
}

export type { CategoryFilter };
