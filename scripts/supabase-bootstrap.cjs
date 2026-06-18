#!/usr/bin/env node
/**
 * One-time Supabase bootstrap: fetch API keys and apply SQL migrations.
 *
 * Requires a personal access token from:
 * https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-bootstrap.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { env, envPath, root } = require("./backend-mode.cjs");

const PROJECT_REF = "fwsmllrlevehhxdtzzkk";
const API = "https://api.supabase.com/v1";

function readToken() {
  return (
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.SB_ACCESS_TOKEN?.trim() ||
    ""
  );
}

async function apiFetch(pathname, options = {}) {
  const token = readToken();
  if (!token) {
    throw new Error(
      "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens"
    );
  }

  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.message
        ? data.message
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function pickClientKey(keys) {
  if (!Array.isArray(keys)) return null;

  const publishable = keys.find((key) => key.type === "publishable");
  if (publishable?.api_key) return publishable.api_key;

  const anon = keys.find(
    (key) => key.name === "anon" || key.type === "anon" || key.id === "anon"
  );
  if (anon?.api_key) return anon.api_key;

  const legacy = keys.find((key) => typeof key.api_key === "string" && key.api_key.startsWith("eyJ"));
  return legacy?.api_key || null;
}

function updateEnvValue(key, value) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  fs.writeFileSync(envPath, `${next.join("\n").replace(/\n?$/, "\n")}`);
}

async function fetchClientKey() {
  const keys = await apiFetch(
    `/projects/${PROJECT_REF}/api-keys?reveal=true`
  );
  const clientKey = pickClientKey(keys);
  if (!clientKey) {
    throw new Error(
      "Could not find publishable/anon key in Supabase API response."
    );
  }
  return clientKey;
}

async function runMigration(filename) {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations", filename), "utf8");
  await apiFetch(`/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    body: { query: sql },
  });
  console.log(`✓ Ran ${filename}`);
}

async function main() {
  console.log(`Bootstrapping Supabase project ${PROJECT_REF}...`);

  const clientKey = await fetchClientKey();
  updateEnvValue("VITE_SUPABASE_ANON_KEY", clientKey);
  console.log("✓ Wrote VITE_SUPABASE_ANON_KEY to .env");

  for (const file of [
    "001_rollout_studio.sql",
    "002_release_date.sql",
    "003_notification_schedule.sql",
  ]) {
    await runMigration(file);
  }

  console.log("");
  console.log("Next:");
  console.log("  npm run setup:cloud");
  console.log("  npm run dev");
}

main().catch((error) => {
  console.error("✖ Supabase bootstrap failed:", error.message);
  process.exit(1);
});
