import { useState } from "react";
import type { Phase, ProjectDetail, TaskCategory, UpdateTaskInput } from "../../../shared/types";
import {
  CATEGORY_COLORS,
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
  selectedPhaseId: string;
  selectedWeekIndex: number;
  categoryFilter: CategoryFilter;
  onSelectPhase: (phaseId: string) => void;
  onSelectWeek: (weekIndex: number) => void;
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

export function RolloutDashboard({
  project,
  selectedPhaseId,
  selectedWeekIndex,
  categoryFilter,
  onSelectPhase,
  onSelectWeek,
  onCategoryFilter,
  onToggleTask,
  onUpdateTask,
}: RolloutDashboardProps) {
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState("Mon");
  const [editCategory, setEditCategory] = useState<TaskCategory>("admin");
  const [editTask, setEditTask] = useState("");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const selectedPhase =
    project.phases.find((phase) => phase.id === selectedPhaseId) ??
    project.phases[0];
  const safeWeekIndex = Math.min(
    selectedWeekIndex,
    Math.max(selectedPhase.weeks.length - 1, 0)
  );
  const selectedWeek = selectedPhase.weeks[safeWeekIndex];
  const phaseStats = phaseProgress(selectedPhase);
  const remaining = project.totalTasks - project.completedTasks;
  const pct = project.totalTasks
    ? Math.round((project.completedTasks / project.totalTasks) * 100)
    : 0;
  const phasesComplete = project.phases.filter((phase) => {
    const stats = phaseProgress(phase);
    return stats.total > 0 && stats.done === stats.total;
  }).length;

  const visibleTasks = selectedWeek.tasks.filter(
    (task) => categoryFilter === "all" || task.category === categoryFilter
  );

  function startEditing(task: ProjectDetail["phases"][number]["weeks"][number]["tasks"][number]) {
    setEditingTaskId(task.id);
    setEditDay(task.day);
    setEditCategory(task.category);
    setEditTask(task.task);
  }

  function cancelEditing() {
    setEditingTaskId(null);
  }

  async function saveEditing(taskId: string) {
    if (!editTask.trim()) return;
    setSavingTaskId(taskId);
    try {
      await onUpdateTask(taskId, {
        day: editDay,
        category: editCategory,
        task: editTask.trim(),
      });
      setEditingTaskId(null);
    } finally {
      setSavingTaskId(null);
    }
  }

  return (
    <>
      <div className="page-header">
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
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{project.completedTasks}</div>
            <div className="stat-label">Tasks done</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{remaining}</div>
            <div className="stat-label">Remaining</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{pct}%</div>
            <div className="stat-label">Overall progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {phasesComplete}/{project.phases.length}
            </div>
            <div className="stat-label">Phases complete</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            fontSize: 13,
            color: "#9aa3b2",
          }}
        >
          <span>Campaign progress</span>
          <span>
            {project.completedTasks} / {project.totalTasks}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="layout-grid">
        <aside className="sidebar">
          <h2 className="section-title">Phases</h2>
          <div className="phase-nav">
            {project.phases.map((phase) => {
              const stats = phaseProgress(phase);
              return (
                <button
                  key={phase.id}
                  type="button"
                  className={`phase-button ${
                    phase.id === selectedPhase.id ? "active" : ""
                  }`}
                  onClick={() => onSelectPhase(phase.id)}
                >
                  <div className="phase-button-top">
                    <span
                      className="swatch"
                      style={{ background: PHASE_COLORS[phase.color] }}
                    />
                    <div className="phase-meta">
                      <div className="phase-name">Phase {phase.sortOrder + 1}</div>
                      <div className="phase-title">{phase.title}</div>
                    </div>
                    <div className="phase-count">
                      {stats.done}/{stats.total}
                    </div>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${stats.pct}%`,
                        background: PHASE_COLORS[phase.color],
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="callout">
            <strong>The funnel:</strong> {project.funnelNote}
          </div>

          <div className="sidebar-card" style={{ marginTop: 16 }}>
            <h3 className="section-title">Timeline</h3>
            <div className="timeline-list">
              {project.phases.flatMap((phase) =>
                phase.weeks.map((week) => (
                  <span key={week.id}>{week.label}</span>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="main-panel panel-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 className="main-heading">
                Phase {selectedPhase.sortOrder + 1}: {selectedPhase.title}
              </h2>
              <p className="main-subheading">
                {phaseStats.done} of {phaseStats.total} tasks complete in this
                phase
              </p>
            </div>
            <div style={{ width: 220 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 8,
                  fontSize: 12,
                  color: "#9aa3b2",
                }}
              >
                {phaseStats.done}/{phaseStats.total}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${phaseStats.pct}%`,
                    background: PHASE_COLORS[selectedPhase.color],
                  }}
                />
              </div>
            </div>
          </div>

          {selectedPhase.weeks.length > 1 ? (
            <div className="pill-row" style={{ marginBottom: 16 }}>
              {selectedPhase.weeks.map((week, index) => (
                <button
                  key={week.id}
                  type="button"
                  className={`pill ${index === safeWeekIndex ? "active" : ""}`}
                  onClick={() => onSelectWeek(index)}
                >
                  {week.label}
                </button>
              ))}
            </div>
          ) : null}

          <div style={{ marginBottom: 16 }}>
            <h3 className="main-heading">{selectedWeek.label}</h3>
            <p className="main-subheading">{selectedWeek.subtitle}</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                color: "#9aa3b2",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Filter by category
            </div>
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

          <div className="task-table-wrap">
            <table className="task-table">
              <thead>
                <tr>
                  <th className="center">Done</th>
                  <th className="day">Day</th>
                  <th>Category</th>
                  <th>Task</th>
                  <th className="task-actions-col">Edit</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        No tasks match this filter.
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((task) => {
                    const isEditing = editingTaskId === task.id;
                    return (
                    <tr
                      key={task.id}
                      className={[
                        task.completed ? "done" : "",
                        celebratingTaskId === task.id ? "task-complete-celebrate" : "",
                        isEditing ? "task-editing" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          disabled={isEditing}
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
                      </td>
                      <td className="day">
                        {isEditing ? (
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
                        ) : (
                          task.day
                        )}
                      </td>
                      <td>
                        {isEditing ? (
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
                        ) : (
                          <span className="category-chip">
                            <span
                              className="swatch"
                              style={{
                                background: CATEGORY_COLORS[task.category],
                              }}
                            />
                            {CATEGORY_LABELS[task.category]}
                          </span>
                        )}
                      </td>
                      <td className="task-copy">
                        {isEditing ? (
                          <textarea
                            className="task-inline-textarea"
                            value={editTask}
                            onChange={(event) => setEditTask(event.target.value)}
                            rows={3}
                          />
                        ) : (
                          task.task
                        )}
                      </td>
                      <td className="task-actions-col">
                        {isEditing ? (
                          <div className="task-inline-actions">
                            <button
                              type="button"
                              className="button primary"
                              disabled={savingTaskId === task.id || !editTask.trim()}
                              onClick={() => void saveEditing(task.id)}
                            >
                              {savingTaskId === task.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="button ghost"
                              disabled={savingTaskId === task.id}
                              onClick={cancelEditing}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="button ghost task-edit-button"
                            onClick={() => startEditing(task)}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export type { CategoryFilter };
