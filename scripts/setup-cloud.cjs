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
    const url = env.VITE_SUPABASE_URL?.trim();
    if (url && !url.includes("your-project")) {
      const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (ref) {
        console.log("");
        console.log("Your project URL is set. Still need the anon key:");
        console.log(`  https://supabase.com/dashboard/project/${ref}/settings/api`);
      }
    }
    process.exitCode = 1;
    return;
  }

  const ref = env.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const dash = ref ? `https://supabase.com/dashboard/project/${ref}` : null;

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

  let schemaReady = false;
  try {
    const probe = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?select=id&limit=1`, {
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      },
    });
    schemaReady = probe.ok;
    if (!schemaReady && probe.status === 404) {
      console.log("");
      console.log("Database schema not found yet — run the migration SQL first.");
    }
  } catch {
    // ignore probe errors
  }

  console.log("");
  if (schemaReady) {
    console.log("Schema looks ready (projects table reachable).");
  } else {
    console.log("One-time setup in Supabase:");
    if (dash) {
      console.log(`1. Run: SUPABASE_ACCESS_TOKEN=sbp_... npm run setup:supabase`);
      console.log(`   (token from https://supabase.com/dashboard/account/tokens)`);
      console.log(`   Or paste SQL manually in SQL Editor:`);
      console.log(`   ${dash}/sql/new`);
      console.log(`   → supabase/migrations/001_rollout_studio.sql`);
      console.log(`   → supabase/migrations/002_release_date.sql`);
      console.log(`   → supabase/migrations/003_notification_schedule.sql`);
      console.log(`   → supabase/migrations/004_user_tracking.sql`);
      console.log(`   → supabase/migrations/005_growth_hub.sql`);
      console.log(`   → supabase/migrations/006_admin_stats_rpc.sql`);
      console.log(`2. Authentication → Providers → enable Email`);
      console.log(`   ${dash}/auth/providers`);
      console.log(`3. (Recommended) Turn off “Confirm email” for easier sign-up, or leave on`);
      console.log(`   ${dash}/auth/providers`);
    } else {
      console.log("1. Run supabase/migrations/001_rollout_studio.sql in SQL Editor");
      console.log("2. Enable Email auth under Authentication → Providers");
    }
  }

  console.log("");
  console.log("Privacy contact for the public app: killscomfort@gmail.com");
  console.log("Share VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY with app users (anon key is public-safe with RLS).");
}

function verifyBuildEnv() {
  if (!cloud) {
    console.error("");
    console.error("Vercel build is missing Supabase environment variables.");
    console.error("Set these in the Vercel project → Settings → Environment Variables, then redeploy:");
    console.error("  VITE_SUPABASE_URL=https://<project-ref>.supabase.co");
    console.error("  VITE_SUPABASE_ANON_KEY=<anon or publishable key from Supabase → Settings → API>");
    console.error("");
    console.error("Use the real anon/publishable key — not the placeholder from .env.example.");
    process.exit(1);
  }

  console.log("Supabase env vars OK for Vercel build.");
}

const command = process.argv[2];

if (command === "write") {
  writeBackendMode(path.join(root, "client/dist"));
} else if (command === "verify-build") {
  verifyBuildEnv();
} else if (command === "check") {
  void checkSupabase();
} else {
  console.log(`Usage: node scripts/setup-cloud.cjs <check|verify-build|write>`);
  process.exitCode = 1;
}
