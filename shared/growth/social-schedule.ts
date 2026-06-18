import type { PitchDraft, SocialPlatform } from "./types";

export const SUBMISSION_STATUS_LABELS = {
  to_submit: "To submit",
  submitted: "Submitted",
  follow_up: "Follow up",
  added: "Added / signed",
  passed: "Passed",
} as const;

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube Shorts",
  soundcloud: "SoundCloud",
  spotify: "Spotify (pitch)",
};

/** Electronic / DJ default best windows (local hour, 24h). Refined by logged post data. */
export const DEFAULT_POST_WINDOWS: Record<
  SocialPlatform,
  Array<{ day: string; hour: number; score: number }>
> = {
  tiktok: [
    { day: "Tue", hour: 19, score: 92 },
    { day: "Thu", hour: 21, score: 90 },
    { day: "Fri", hour: 12, score: 86 },
    { day: "Sat", hour: 11, score: 84 },
    { day: "Sun", hour: 20, score: 82 },
  ],
  instagram: [
    { day: "Wed", hour: 18, score: 91 },
    { day: "Fri", hour: 17, score: 88 },
    { day: "Sat", hour: 10, score: 85 },
    { day: "Tue", hour: 20, score: 83 },
    { day: "Thu", hour: 12, score: 80 },
  ],
  youtube: [
    { day: "Fri", hour: 15, score: 87 },
    { day: "Sat", hour: 14, score: 85 },
    { day: "Wed", hour: 17, score: 82 },
    { day: "Sun", hour: 11, score: 80 },
  ],
  soundcloud: [
    { day: "Thu", hour: 16, score: 84 },
    { day: "Fri", hour: 14, score: 82 },
    { day: "Tue", hour: 13, score: 78 },
  ],
  spotify: [
    { day: "Mon", hour: 10, score: 95 },
    { day: "Wed", hour: 10, score: 90 },
  ],
};

export function buildPitchText(draft: PitchDraft): string {
  return [
    `Track: ${draft.trackName}`,
    `Genre: ${draft.genre}`,
    `BPM: ${draft.bpm}`,
    `Hook: ${draft.hook}`,
    `Sounds like: ${draft.comparisonArtists}`,
    `Private link: ${draft.privateLink}`,
    draft.bookingUrl ? `Live bookings: ${draft.bookingUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface CsvSocialRow {
  platform: SocialPlatform;
  postedAt: string;
  views: number;
  saves: number;
  shares: number;
  linkClicks: number;
  notes: string;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizePlatform(value: string): SocialPlatform | null {
  const key = value.trim().toLowerCase();
  if (key.includes("tiktok")) return "tiktok";
  if (key.includes("instagram") || key === "ig") return "instagram";
  if (key.includes("youtube") || key === "shorts") return "youtube";
  if (key.includes("soundcloud")) return "soundcloud";
  if (key.includes("spotify")) return "spotify";
  return null;
}

function parseNumber(value: string): number {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseSocialPostsCsv(text: string): CsvSocialRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const platformIndex = headers.findIndex((header) => header.includes("platform"));
  const dateIndex = headers.findIndex(
    (header) => header.includes("date") || header.includes("posted")
  );
  const viewsIndex = headers.findIndex((header) => header.includes("view"));
  const savesIndex = headers.findIndex(
    (header) => header.includes("save") || header.includes("bookmark")
  );
  const sharesIndex = headers.findIndex((header) => header.includes("share"));
  const clicksIndex = headers.findIndex(
    (header) => header.includes("click") || header.includes("link")
  );
  const notesIndex = headers.findIndex(
    (header) => header.includes("note") || header.includes("caption")
  );

  const rows: CsvSocialRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const platform = normalizePlatform(cells[platformIndex] ?? "");
    if (!platform) continue;

    const postedAtRaw = cells[dateIndex] ?? "";
    const postedAt = postedAtRaw
      ? new Date(postedAtRaw).toISOString()
      : new Date().toISOString();

    rows.push({
      platform,
      postedAt: Number.isNaN(Date.parse(postedAt)) ? new Date().toISOString() : postedAt,
      views: viewsIndex >= 0 ? parseNumber(cells[viewsIndex] ?? "0") : 0,
      saves: savesIndex >= 0 ? parseNumber(cells[savesIndex] ?? "0") : 0,
      shares: sharesIndex >= 0 ? parseNumber(cells[sharesIndex] ?? "0") : 0,
      linkClicks: clicksIndex >= 0 ? parseNumber(cells[clicksIndex] ?? "0") : 0,
      notes: notesIndex >= 0 ? cells[notesIndex] ?? "" : "",
    });
  }

  return rows;
}

export function recommendPostWindows(
  platform: SocialPlatform,
  loggedPosts: Array<{ postedAt: string; views: number }>
) {
  const defaults = DEFAULT_POST_WINDOWS[platform] ?? [];
  if (loggedPosts.length < 3) {
    return defaults;
  }

  const buckets = new Map<string, { total: number; count: number }>();

  for (const post of loggedPosts) {
    const date = new Date(post.postedAt);
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    const hour = date.getHours();
    const key = `${day}-${hour}`;
    const current = buckets.get(key) ?? { total: 0, count: 0 };
    current.total += post.views;
    current.count += 1;
    buckets.set(key, current);
  }

  const learned = [...buckets.entries()]
    .map(([key, stats]) => {
      const [day, hour] = key.split("-");
      return {
        day,
        hour: Number(hour),
        score: Math.round(stats.total / stats.count),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  return learned.length > 0 ? learned : defaults;
}
