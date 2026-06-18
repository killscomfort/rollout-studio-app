export type SubmissionStatus =
  | "to_submit"
  | "submitted"
  | "follow_up"
  | "added"
  | "passed";

export type SocialPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "soundcloud"
  | "spotify";

export interface CuratedPlaylist {
  id: string;
  name: string;
  platform: "spotify" | "soundcloud";
  genre: string;
  followerRange: string;
  contactUrl: string;
  submitMethod: string;
  notes: string;
}

export interface CuratedLabel {
  id: string;
  name: string;
  genre: string;
  type: "open_submissions" | "demo_drop" | "email_pitch";
  contactUrl: string;
  notes: string;
  whenToPitch: string;
}

export interface PlaylistSubmission {
  id: string;
  projectId: string;
  curatedId: string | null;
  name: string;
  platform: string;
  contactUrl: string;
  status: SubmissionStatus;
  notes: string;
  submittedAt: string | null;
  updatedAt: string;
}

export interface LabelSubmission {
  id: string;
  projectId: string;
  curatedId: string | null;
  name: string;
  contactUrl: string;
  status: SubmissionStatus;
  notes: string;
  submittedAt: string | null;
  updatedAt: string;
}

export interface SocialPostLog {
  id: string;
  projectId: string;
  platform: SocialPlatform;
  postedAt: string;
  views: number;
  saves: number;
  shares: number;
  linkClicks: number;
  notes: string;
  taskId: string | null;
}

export interface ProjectGrowthData {
  playlistSubmissions: PlaylistSubmission[];
  labelSubmissions: LabelSubmission[];
  socialPosts: SocialPostLog[];
}

export interface PitchDraft {
  trackName: string;
  genre: string;
  bpm: string;
  hook: string;
  comparisonArtists: string;
  privateLink: string;
  bookingUrl: string;
}
