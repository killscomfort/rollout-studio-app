import { resolve } from "node:path";
import { notificationConfig, requireIcloudCredentials } from "./config.ts";
import { connect, findCalendar, upsertEvents } from "./caldav.ts";
import { sendPushcut } from "./pushcut.ts";
import { loadState, pushKey, saveState } from "./state.ts";
import { buildNotificationSchedule, loadProjectFromDb } from "./load-project.ts";

const ROOT = process.cwd();
const STATE_PATH = resolve(ROOT, ".rollout-push-state.json");
const PUSH_GRACE_MINUTES = 60;

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const onlySync = args.has("--sync") && !args.has("--push");
  const onlyPush = args.has("--push") && !args.has("--sync");
  const doSync = !onlyPush;
  const doPush = !onlySync;

  const projectRef =
    [...args].find((arg) => arg.startsWith("--project="))?.split("=")[1] ||
    notificationConfig.projectRef;

  const project = loadProjectFromDb(projectRef || undefined);
  const { tasks } = buildNotificationSchedule(project);

  console.log(
    `Rollout notifications — ${project.name} | ${tasks.length} task(s) | calendar "${notificationConfig.calendarName}" | ${notificationConfig.timezone}`
  );

  if (tasks.length === 0) {
    console.log("  No upcoming tasks to sync (all complete or empty plan).");
    return;
  }

  if (doSync) {
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
