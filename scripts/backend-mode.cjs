#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function loadEnv(filePath) {
  const values = {};

  if (fs.existsSync(filePath)) {
    for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      values[key] = value;
    }
  }

  for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
    const fromProcess = process.env[key]?.trim();
    if (fromProcess) {
      values[key] = fromProcess;
    }
  }

  return values;
}

function hasCloudBackend(env) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return false;
  if (url.includes("your-project") || key === "your-anon-key") return false;
  return true;
}

const env = loadEnv(envPath);
const cloud = hasCloudBackend(env);

module.exports = {
  root,
  envPath,
  env,
  cloud,
  hasCloudBackend,
};

if (require.main === module) {
  console.log(cloud ? "cloud" : "local");
}
