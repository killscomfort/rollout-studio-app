import { Router } from "express";
import type { Database } from "better-sqlite3";
import { validateSyncBundle } from "../../../shared/sync";
import { exportSyncBundle, importSyncBundle } from "../sync";

export function createSyncRouter(db: Database) {
  const router = Router();

  router.get("/export", (_req, res) => {
    res.json(exportSyncBundle(db));
  });

  router.post("/import", (req, res) => {
    try {
      const bundle = validateSyncBundle(req.body);
      const result = importSyncBundle(db, bundle);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid sync file",
      });
    }
  });

  return router;
}
