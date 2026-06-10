#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { cloud, env, envPath, root } = require("./backend-mode.cjs");

function writeBackendMode(distDir) {
  const target = path.join(distDir, "backend-mode.json");
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(
    target,
    JSON.stringify(
      {
        mode: cloud ? "cloud" : "local",
        supabaseUrl: cloud ? env.VITE_SUPABASE_URL : null,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${target} (${cloud ? "cloud" : "local"})`);
}

async function checkSupabase() {
  if (!cloud) {
    console.log("Cloud backend not configured.");
    console.log(`Copy ${path.join(root, ".env.example")} to .env and add Supabase keys.`);
    process.exitCode = 1;
    return;
  }

  const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/health`, {
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    console.error("Could not reach Supabase. Check VITE_SUPABASE_URL and your network.");
    process.exitCode = 1;
    return;
  }

  console.log("Supabase connection OK.");
  console.log("Next steps:");
  console.log("1. Open Supabase SQL Editor");
  console.log("2. Run supabase/migrations/001_rollout_studio.sql");
  console.log("3. Enable Email auth in Authentication → Providers");
  console.log("4. Share .env with anyone using this app build");
}

const command = process.argv[2];

if (command === "write") {
  writeBackendMode(path.join(root, "client/dist"));
} else if (command === "check") {
  void checkSupabase();
} else {
  console.log(`Usage: node scripts/setup-cloud.cjs <check|write>`);
  process.exitCode = 1;
}
