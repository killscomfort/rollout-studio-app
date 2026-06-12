import { useMemo, useState } from "react";
import type { PhaseTemplate, ProjectDetail, ProjectTemplate } from "../../../shared/types";
import {
  CATEGORY_LABELS,
  PHASE_COLORS,
  type PhaseColor,
  type TaskCategory,
} from "../../../shared/types";
import {
  applyPersonalization,
  clonePhases,
  DAY_OPTIONS,
  projectPhasesToTemplate,
  projectToPlanTemplate,
  TASK_CATEGORIES,
} from "../lib/plan-utils";

interface PlanEditorProps {
  project: ProjectDetail;
  onSave: (template: ProjectTemplate) => Promise<void>;
  onError: (message: string) => void;
}

export function PlanEditor({ project, onSave, onError }: PlanEditorProps) {
  const [phases, setPhases] = useState<PhaseTemplate[]>(() =>
    clonePhases(projectPhasesToTemplate(project.phases))
  );
  const [trackName, setTrackName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [city, setCity] = useState("");
  const [bookingUrl, setBookingUrl] = useState(project.bookingUrl);
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [planJson, setPlanJson] = useState("");

  const taskCount = useMemo(
    () => phases.reduce((sum, phase) => sum + phase.weeks.reduce((w, week) => w + week.tasks.length, 0), 0),
    [phases]
  );

  function updatePhaseTitle(phaseIndex: number, title: string) {
    setPhases((current) =>
      current.map((phase, index) => (index === phaseIndex ? { ...phase, title } : phase))
    );
  }

  function updateWeekField(
    phaseIndex: number,
    weekIndex: number,
    field: "label" | "subtitle",
    value: string
  ) {
    setPhases((current) =>
      current.map((phase, pi) =>
        pi !== phaseIndex
          ? phase
          : {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi !== weekIndex ? week : { ...week, [field]: value }
              ),
            }
      )
    );
  }

  function updateTask(
    phaseIndex: number,
    weekIndex: number,
    taskIndex: number,
    field: "day" | "category" | "task",
    value: string
  ) {
    setPhases((current) =>
      current.map((phase, pi) =>
        pi !== phaseIndex
          ? phase
          : {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi !== weekIndex
                  ? week
                  : {
                      ...week,
                      tasks: week.tasks.map((task, ti) =>
                        ti !== taskIndex
                          ? task
                          : {
                              ...task,
                              [field]:
                                field === "category" ? (value as TaskCategory) : value,
                            }
                      ),
                    }
              ),
            }
      )
    );
  }

  function addTask(phaseIndex: number, weekIndex: number) {
    setPhases((current) =>
      current.map((phase, pi) =>
        pi !== phaseIndex
          ? phase
          : {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi !== weekIndex
                  ? week
                  : {
                      ...week,
                      tasks: [
                        ...week.tasks,
                        { day: "Mon", category: "admin", task: "New task" },
                      ],
                    }
              ),
            }
      )
    );
  }

  function removeTask(phaseIndex: number, weekIndex: number, taskIndex: number) {
    setPhases((current) =>
      current.map((phase, pi) =>
        pi !== phaseIndex
          ? phase
          : {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi !== weekIndex
                  ? week
                  : {
                      ...week,
                      tasks: week.tasks.filter((_, ti) => ti !== taskIndex),
                    }
              ),
            }
      )
    );
  }

  function handlePersonalize() {
    setPhases((current) =>
      applyPersonalization(current, {
        trackName: trackName.trim(),
        artistName: artistName.trim(),
        city: city.trim(),
        bookingUrl: bookingUrl.trim(),
      })
    );
  }

  function openAdvancedJson() {
    setPlanJson(
      JSON.stringify(
        {
          ...projectToPlanTemplate(project),
          bookingUrl: bookingUrl.trim() || project.bookingUrl,
          phases,
        },
        null,
        2
      )
    );
    setShowAdvanced(true);
  }

  async function handleSave() {
    setBusy(true);
    try {
      const template: ProjectTemplate = {
        ...projectToPlanTemplate(project),
        bookingUrl: bookingUrl.trim() || project.bookingUrl,
        phases,
      };
      await onSave(template);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setBusy(false);
    }
  }

  async function importAdvancedJson() {
    try {
      const parsed = JSON.parse(planJson) as { phases?: PhaseTemplate[] };
      if (!parsed.phases?.length) {
        throw new Error("JSON must include a non-empty phases array.");
      }
      setPhases(clonePhases(parsed.phases));
      setShowAdvanced(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Invalid plan JSON");
    }
  }

  return (
    <div className="plan-editor">
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Adjust phases, weeks, and tasks for your release. Saving replaces the schedule
        and clears checked tasks for this project.
      </p>

      <div className="plan-personalize panel-card">
        <h3 className="section-title">Quick personalize</h3>
        <p className="page-subtitle" style={{ marginBottom: 12 }}>
          Fill in your details, then apply to replace placeholders like &quot;Your Track
          Title&quot; and &quot;your city&quot; across the plan.
        </p>
        <div className="form-grid">
          <label>
            Track name
            <input
              value={trackName}
              onChange={(event) => setTrackName(event.target.value)}
              placeholder="Your Track Title"
            />
          </label>
          <label>
            Artist name
            <input
              value={artistName}
              onChange={(event) => setArtistName(event.target.value)}
              placeholder="your artist name"
            />
          </label>
          <label>
            City / scene
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="your city"
            />
          </label>
          <label>
            Booking / link URL
            <input
              value={bookingUrl}
              onChange={(event) => setBookingUrl(event.target.value)}
              placeholder="https://your-link.com"
            />
          </label>
        </div>
        <div className="toolbar">
          <button type="button" className="button" onClick={handlePersonalize}>
            Apply to plan
          </button>
        </div>
      </div>

      <div className="plan-editor-summary">
        {phases.length} phases · {taskCount} tasks
      </div>

      <div className="plan-phase-list">
        {phases.map((phase, phaseIndex) => (
          <details key={`${phase.title}-${phaseIndex}`} className="plan-phase panel-card" open={phaseIndex === 0}>
            <summary className="plan-phase-summary">
              <span
                className="swatch"
                style={{ background: PHASE_COLORS[phase.color as PhaseColor] ?? PHASE_COLORS.blue }}
              />
              <input
                className="plan-inline-input plan-phase-title"
                value={phase.title}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updatePhaseTitle(phaseIndex, event.target.value)}
              />
            </summary>

            {phase.weeks.map((week, weekIndex) => (
              <div key={`${week.label}-${weekIndex}`} className="plan-week">
                <div className="plan-week-header">
                  <input
                    className="plan-inline-input"
                    value={week.label}
                    onChange={(event) =>
                      updateWeekField(phaseIndex, weekIndex, "label", event.target.value)
                    }
                  />
                  <input
                    className="plan-inline-input plan-week-subtitle"
                    value={week.subtitle}
                    onChange={(event) =>
                      updateWeekField(phaseIndex, weekIndex, "subtitle", event.target.value)
                    }
                  />
                </div>

                <div className="plan-task-list">
                  {week.tasks.map((task, taskIndex) => (
                    <div key={`${taskIndex}-${task.task.slice(0, 12)}`} className="plan-task-row">
                      <select
                        value={task.day}
                        onChange={(event) =>
                          updateTask(phaseIndex, weekIndex, taskIndex, "day", event.target.value)
                        }
                      >
                        {DAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                      <select
                        value={task.category}
                        onChange={(event) =>
                          updateTask(
                            phaseIndex,
                            weekIndex,
                            taskIndex,
                            "category",
                            event.target.value
                          )
                        }
                      >
                        {TASK_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                      <input
                        className="plan-inline-input plan-task-text"
                        value={task.task}
                        onChange={(event) =>
                          updateTask(phaseIndex, weekIndex, taskIndex, "task", event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="button ghost plan-task-remove"
                        onClick={() => removeTask(phaseIndex, weekIndex, taskIndex)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="button ghost"
                  onClick={() => addTask(phaseIndex, weekIndex)}
                >
                  Add task
                </button>
              </div>
            ))}
          </details>
        ))}
      </div>

      <div className="toolbar" style={{ marginTop: 16 }}>
        <button type="button" className="button primary" disabled={busy} onClick={() => void handleSave()}>
          {busy ? "Saving plan…" : "Save plan"}
        </button>
        <button type="button" className="button ghost" onClick={openAdvancedJson}>
          Advanced JSON
        </button>
      </div>

      {showAdvanced ? (
        <div className="panel-card" style={{ marginTop: 16 }}>
          <h3 className="section-title">Advanced JSON</h3>
          <textarea
            value={planJson}
            onChange={(event) => setPlanJson(event.target.value)}
            style={{ width: "100%", minHeight: 280, fontFamily: "monospace" }}
          />
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button type="button" className="button primary" onClick={() => void importAdvancedJson().catch(() => undefined)}>
              Load JSON into editor
            </button>
            <button type="button" className="button ghost" onClick={() => setShowAdvanced(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
