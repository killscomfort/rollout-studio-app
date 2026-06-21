import { resolve } from "node:path";
import type { NotificationTask } from "../../shared/calendar.ts";
import { notificationConfig, hasIcloudCredentials, requireIcloudCredentials } from "./config.ts";
import { connect, findCalendar, upsertEvents } from "./caldav.ts";
import { sendPushcut } from "./pushcut.ts";
import { loadState, pushKey, saveState } from "./state.ts";
import { buildNotificationSchedule, loadProject } from "./load-project.ts";

const ROOT = process.cwd();
const STATE_PATH = resolve(ROOT, ".rollout-push-state.json");
const PUSH_GRACE_MINUTES = 60;

function projectRefFromArgs(args: Set<string>) {
  return (
    [...args].find((arg) => arg.startsWith("--project="))?.split("=")[1] ||
    notificationConfig.projectRef
  );
}

function formatWhen(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function runPreview(projectRef?: string) {
  const { project, source } = await loadProject(projectRef || undefined);
  const { tasks } = buildNotificationSchedule(project);

  console.log(`Preview — ${project.name} (${source})`);
  console.log(`  Release date: ${project.releaseDate}`);
  console.log(`  Calendar: ${notificationConfig.calendarName}`);
  console.log(`  Timezone: ${notificationConfig.timezone}`);
  if (project.notificationSchedule) {
    console.log(`  Project schedule: ${project.notificationSchedule.timezone}`);
  }
  console.log(`  Upcoming tasks: ${tasks.length}`);
  console.log("");

  const sample = tasks.slice(0, 5);
  for (const task of sample) {
    console.log(`  • ${formatWhen(task.start)} — ${task.title}`);
    if (task.push && task.pushAt) {
      console.log(`    Pushcut at ${formatWhen(task.pushAt)}`);
    }
  }
  if (tasks.length > sample.length) {
    console.log(`  … and ${tasks.length - sample.length} more`);
  }

  const next = tasks.find((task) => task.start.getTime() > Date.now());
  if (next) {
    console.log("");
    console.log(`Next calendar alert window: ${formatWhen(next.start)}`);
  }
}

async function runTestPush() {
  if (!notificationConfig.pushcutApiKey) {
    throw new Error(
      "Set PUSHCUT_API_KEY in .env (Pushcut app → Account → API Keys)."
    );
  }

  await sendPushcut({
    apiKey: notificationConfig.pushcutApiKey,
    notificationName: notificationConfig.pushcutNotification,
    title: "Rollout Studio test",
    text: "If you see this, Pushcut nudges are wired up.",
    link: "https://killscomfort.com/book",
  });

  console.log(
    `✓ Sent test push via Pushcut notification "${notificationConfig.pushcutNotification}". Check your iPhone.`
  );
}

async function runTestCalendar(minutesFromNow: number) {
  const { appleId, appPassword } = requireIcloudCredentials();
  const client = await connect(appleId, appPassword);
  const calendar = await findCalendar(client, notificationConfig.calendarName);
  const start = new Date(Date.now() + minutesFromNow * 60_000);
  const end = new Date(start.getTime() + 30 * 60_000);
  const testTask: NotificationTask = {
    id: `test-${Date.now()}`,
    title: "Rollout Studio test reminder",
    start,
    end,
    notes: "Test event from Rollout Studio. You can delete this after verifying alerts.",
    link: "https://killscomfort.com/book",
    alertMinutes: 1,
    push: false,
  };

  const results = await upsertEvents(
    client,
    calendar,
    [testTask],
    notificationConfig.calendarName,
    notificationConfig.timezone
  );

  console.log(
    `✓ Created test calendar event at ${formatWhen(start)} (${results[0]?.action}).`
  );
  console.log("  Check iPhone Calendar notifications in ~1 minute.");
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const projectRef = projectRefFromArgs(args);

  if (args.has("--preview")) {
    await runPreview(projectRef || undefined);
    return;
  }

  if (args.has("--test-push")) {
    await runTestPush();
    return;
  }

  if (args.has("--test-calendar")) {
    const minutesArg = [...args]
      .find((arg) => arg.startsWith("--in="))
      ?.split("=")[1];
    const minutes = minutesArg ? Number(minutesArg) : 3;
    await runTestCalendar(Number.isFinite(minutes) ? minutes : 3);
    return;
  }

  const onlySync = args.has("--sync") && !args.has("--push");
  const onlyPush = args.has("--push") && !args.has("--sync");
  const doSync = !onlyPush;
  const doPush = !onlySync;

  const { project, source } = await loadProject(projectRef || undefined);
  const { tasks } = buildNotificationSchedule(project);

  console.log(
    `Rollout notifications — ${project.name} (${source}) | ${tasks.length} task(s) | calendar "${notificationConfig.calendarName}" | ${notificationConfig.timezone}`
  );

  if (tasks.length === 0) {
    console.log("  No upcoming tasks to sync (all complete or empty plan).");
    return;
  }

  if (doSync) {
    if (!hasIcloudCredentials()) {
      console.log(
        "  [cal]  ICLOUD_APPLE_ID not set — skipping calendar sync (Pushcut still runs)."
      );
    } else {
      const { appleId, appPassword } = requireIcloudCredentials();
      const client = await connect(appleId, appPassword);
      const calendar = await findCalendar(client, notificationConfig.calendarName);
      const results = await upsertEvents(
        client,
        calendar,
        tasks,
        notificationConfig.calendarName,
        notificationConfig.timezone
      );
      for (const result of results) {
        console.log(`  [cal]  ${result.action.padEnd(7)} ${result.id}`);
      }
    }
  }

  if (doPush) {
    if (!notificationConfig.pushcutApiKey) {
      console.log(
        "  [push] PUSHCUT_API_KEY not set — skipping (calendar alerts still active)."
      );
    } else {
      const state = loadState(STATE_PATH);
      const now = Date.now();
      let sent = 0;

      for (const task of tasks) {
        if (!task.push || !task.pushAt) continue;
        const key = pushKey(task.id, task.pushAt);
        if (state.pushed[key]) continue;

        const pushMs = task.pushAt.getTime();
        const inWindow =
          now >= pushMs && now <= pushMs + PUSH_GRACE_MINUTES * 60_000;
        if (!inWindow) continue;

        await sendPushcut({
          apiKey: notificationConfig.pushcutApiKey,
          notificationName: notificationConfig.pushcutNotification,
          title: "KillsComfort Rollout",
          text: task.title,
          link: task.link,
        });
        state.pushed[key] = new Date().toISOString();
        sent++;
        console.log(`  [push] sent    ${task.id}`);
      }

      saveState(STATE_PATH, state);
      if (sent === 0) console.log("  [push] nothing due right now");
    }
  }
}

main().catch((err) => {
  console.error(
    "✖ Rollout notifications failed:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
