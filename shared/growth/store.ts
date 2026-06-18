import type {
  LabelSubmission,
  PlaylistSubmission,
  ProjectGrowthData,
  SocialPostLog,
  SubmissionStatus,
} from "./types";

export const EMPTY_GROWTH_DATA: ProjectGrowthData = {
  playlistSubmissions: [],
  labelSubmissions: [],
  socialPosts: [],
};

export function parseGrowthData(value: unknown): ProjectGrowthData {
  if (value == null || value === "") return { ...EMPTY_GROWTH_DATA };

  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ...EMPTY_GROWTH_DATA };
    }
  }

  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_GROWTH_DATA };
  }

  const record = raw as Record<string, unknown>;
  return {
    playlistSubmissions: Array.isArray(record.playlistSubmissions)
      ? (record.playlistSubmissions as PlaylistSubmission[])
      : [],
    labelSubmissions: Array.isArray(record.labelSubmissions)
      ? (record.labelSubmissions as LabelSubmission[])
      : [],
    socialPosts: Array.isArray(record.socialPosts)
      ? (record.socialPosts as SocialPostLog[])
      : [],
  };
}

export function serializeGrowthData(data: ProjectGrowthData): string {
  return JSON.stringify(data);
}

export function upsertPlaylistSubmission(
  data: ProjectGrowthData,
  submission: PlaylistSubmission
): ProjectGrowthData {
  const existing = data.playlistSubmissions.filter((row) => row.id !== submission.id);
  return {
    ...data,
    playlistSubmissions: [...existing, submission].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
  };
}

export function upsertLabelSubmission(
  data: ProjectGrowthData,
  submission: LabelSubmission
): ProjectGrowthData {
  const existing = data.labelSubmissions.filter((row) => row.id !== submission.id);
  return {
    ...data,
    labelSubmissions: [...existing, submission].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
  };
}

export function upsertSocialPost(
  data: ProjectGrowthData,
  post: SocialPostLog
): ProjectGrowthData {
  const existing = data.socialPosts.filter((row) => row.id !== post.id);
  return {
    ...data,
    socialPosts: [...existing, post].sort(
      (left, right) =>
        new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime()
    ),
  };
}

export function addCuratedPlaylistTargets(
  data: ProjectGrowthData,
  projectId: string,
  playlists: Array<{
    id: string;
    name: string;
    platform: string;
    contactUrl: string;
  }>,
  now: string,
  createId: () => string
): ProjectGrowthData {
  let next = { ...data };
  for (const playlist of playlists) {
    if (
      next.playlistSubmissions.some(
        (row) => row.curatedId === playlist.id || row.name === playlist.name
      )
    ) {
      continue;
    }
    next = upsertPlaylistSubmission(next, {
      id: createId(),
      projectId,
      curatedId: playlist.id,
      name: playlist.name,
      platform: playlist.platform,
      contactUrl: playlist.contactUrl,
      status: "to_submit",
      notes: "",
      submittedAt: null,
      updatedAt: now,
    });
  }
  return next;
}

export function addCuratedLabelTargets(
  data: ProjectGrowthData,
  projectId: string,
  labels: Array<{ id: string; name: string; contactUrl: string }>,
  now: string,
  createId: () => string
): ProjectGrowthData {
  let next = { ...data };
  for (const label of labels) {
    if (
      next.labelSubmissions.some(
        (row) => row.curatedId === label.id || row.name === label.name
      )
    ) {
      continue;
    }
    next = upsertLabelSubmission(next, {
      id: createId(),
      projectId,
      curatedId: label.id,
      name: label.name,
      contactUrl: label.contactUrl,
      status: "to_submit",
      notes: "",
      submittedAt: null,
      updatedAt: now,
    });
  }
  return next;
}

export function countByStatus<T extends { status: SubmissionStatus }>(rows: T[]) {
  return rows.reduce<Record<SubmissionStatus, number>>(
    (counts, row) => {
      counts[row.status] += 1;
      return counts;
    },
    { to_submit: 0, submitted: 0, follow_up: 0, added: 0, passed: 0 }
  );
}
