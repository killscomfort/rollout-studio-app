import cors from "cors";
import express from "express";
import { createProjectRouter } from "./routes/projects";
import { createSyncRouter } from "./routes/sync";
import { getDb, initDb } from "./db";

const PORT = Number(process.env.ROLLOUT_PORT ?? 3847);

export function createApp() {
  const db = getDb();
  initDb(db);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/projects", createProjectRouter(db));
  app.use("/api/sync", createSyncRouter(db));

  return { app, db, port: PORT };
}

export function startServer() {
  const { app, port } = createApp();
  return app.listen(port, "127.0.0.1", () => {
    console.log(`Rollout Studio API listening on http://127.0.0.1:${port}`);
  });
}

startServer();
