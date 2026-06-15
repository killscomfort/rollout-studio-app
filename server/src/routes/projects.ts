import { Router } from "express";
import type { Database } from "better-sqlite3";
import type { CreateProjectInput, ProjectTemplate, UpdateProjectInput } from "../../../shared/types";
import {
  createProjectFromTemplate,
  deleteProject,
  getProject,
  listProjects,
  replacePlan,
  updateProject,
  updateTask,
} from "../db";
import { TEMPLATES, listTemplates } from "../templates";

export function createProjectRouter(db: Database) {
  const router = Router();

  router.get("/templates", (_req, res) => {
    res.json(listTemplates());
  });

  router.get("/", (_req, res) => {
    res.json(listProjects(db));
  });

  router.post("/", (req, res) => {
    const input = req.body as CreateProjectInput;
    if (!input?.name?.trim()) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }
    const project = createProjectFromTemplate(db, input);
    res.status(201).json(project);
  });

  router.get("/:id", (req, res) => {
    const project = getProject(db, req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  });

  router.patch("/:id", (req, res) => {
    const project = updateProject(db, req.params.id, req.body as UpdateProjectInput);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  });

  router.delete("/:id", (req, res) => {
    deleteProject(db, req.params.id);
    res.status(204).send();
  });

  router.put("/:id/plan", (req, res) => {
    const template = req.body as ProjectTemplate;
    if (!template?.phases?.length) {
      res.status(400).json({ error: "Plan must include at least one phase" });
      return;
    }
    const project = replacePlan(db, req.params.id, template);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  });

  router.post("/:id/plan/reset", (req, res) => {
    const templateSlug = String(req.body?.templateSlug ?? "blank");
    const template = TEMPLATES[templateSlug];
    if (!template) {
      res.status(400).json({ error: "Unknown template" });
      return;
    }
    const project = replacePlan(db, req.params.id, template);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  });

  router.patch("/:id/tasks/:taskId", (req, res) => {
    try {
      const body = req.body as {
        completed?: boolean;
        day?: string;
        category?: string;
        task?: string;
      };

      if (
        body.completed === undefined &&
        body.day === undefined &&
        body.category === undefined &&
        body.task === undefined
      ) {
        res.status(400).json({ error: "No task fields to update" });
        return;
      }

      updateTask(db, req.params.id, req.params.taskId, body);
      const project = getProject(db, req.params.id);
      res.json(project);
    } catch {
      res.status(404).json({ error: "Task not found for project" });
    }
  });

  return router;
}
