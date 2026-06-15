import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface PushState {
  pushed: Record<string, string>;
}

export function loadState(path: string): PushState {
  if (!existsSync(path)) return { pushed: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PushState;
  } catch {
    return { pushed: {} };
  }
}

export function saveState(path: string, state: PushState): void {
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function pushKey(taskId: string, pushAt: Date): string {
  return `${taskId}@${pushAt.toISOString()}`;
}
