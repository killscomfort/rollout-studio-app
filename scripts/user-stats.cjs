#!/usr/bin/env node
/**
 * Admin summary of cloud users (requires Supabase personal access token).
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run user:stats
 */
const PROJECT_REF = "fwsmllrlevehhxdtzzkk";
const API = "https://api.supabase.com/v1";

function readToken() {
  return (
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.SB_ACCESS_TOKEN?.trim() ||
    ""
  );
}

async function query(sql) {
  const token = readToken();
  if (!token) {
    throw new Error(
      "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens"
    );
  }

  const response = await fetch(`${API}/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
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
      typeof data === "object" && data?.message ? data.message : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function printTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("(no rows)");
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length))
  );

  console.log(columns.map((column, index) => column.padEnd(widths[index])).join("  "));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(
      columns.map((column, index) => String(row[column] ?? "").padEnd(widths[index])).join("  ")
    );
  }
}

async function main() {
  const summary = await query(`
    select
      p.email,
      p.last_platform,
      p.last_seen_at,
      p.created_at as profile_created,
      count(distinct pr.id) as projects,
      count(distinct tp.task_id) as tasks_completed,
      count(distinct ue.id) filter (where ue.created_at > now() - interval '7 days') as events_7d
    from public.profiles p
    left join public.projects pr on pr.user_id = p.id
    left join public.task_progress tp on tp.user_id = p.id
    left join public.user_events ue on ue.user_id = p.id
    group by p.id, p.email, p.last_platform, p.last_seen_at, p.created_at
    order by p.last_seen_at desc
    limit 50;
  `);

  console.log("Rollout Studio — user activity (latest 50)\n");
  printTable(summary);

  const events = await query(`
    select event, count(*) as total
    from public.user_events
    where created_at > now() - interval '30 days'
    group by event
    order by total desc;
  `);

  console.log("\nEvents (last 30 days)\n");
  printTable(events);
}

main().catch((error) => {
  console.error("✖", error.message);
  process.exit(1);
});
