import { useMemo, useState } from "react";
import type { ProjectDetail } from "../../../shared/types";
import type {
  LabelSubmission,
  PitchDraft,
  PlaylistSubmission,
  SocialPlatform,
  SubmissionStatus,
} from "../../../shared/growth/types";
import {
  addCuratedLabelTargets,
  addCuratedPlaylistTargets,
  countByStatus,
  upsertLabelSubmission,
  upsertPlaylistSubmission,
  upsertSocialPost,
} from "../../../shared/growth/store";
import {
  CURATED_LABELS,
  CURATED_PLAYLISTS,
} from "../../../shared/growth/curated";
import {
  buildPitchText,
  parseSocialPostsCsv,
  recommendPostWindows,
  SOCIAL_PLATFORM_LABELS,
  SUBMISSION_STATUS_LABELS,
} from "../../../shared/growth/social-schedule";
import {
  getGrowthIntegrationLinks,
  submitHubLinkForPlaylist,
} from "../lib/growth-integrations";
import { api } from "../api";

type GrowthTab = "social" | "playlists" | "labels";

interface GrowthHubPanelProps {
  project: ProjectDetail;
  onProjectUpdated: (project: ProjectDetail) => void;
  onError: (message: string | null) => void;
  onMessage: (message: string | null) => void;
}

const STATUS_OPTIONS: SubmissionStatus[] = [
  "to_submit",
  "submitted",
  "follow_up",
  "added",
  "passed",
];

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "tiktok",
  "instagram",
  "youtube",
  "soundcloud",
  "spotify",
];

function createId() {
  return crypto.randomUUID();
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized}:00 ${suffix}`;
}

function analyticsLinkForPlatform(
  platform: SocialPlatform,
  links: ReturnType<typeof getGrowthIntegrationLinks>
) {
  switch (platform) {
    case "tiktok":
      return links.tiktokAnalytics;
    case "instagram":
      return links.instagramInsights;
    case "youtube":
      return links.youtubeStudio;
    case "soundcloud":
      return links.soundcloud;
    case "spotify":
      return links.spotifyPitch;
    default:
      return links.spotifyPitch;
  }
}

export function GrowthHubPanel({
  project,
  onProjectUpdated,
  onError,
  onMessage,
}: GrowthHubPanelProps) {
  const [tab, setTab] = useState<GrowthTab>("social");
  const [busy, setBusy] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>("tiktok");
  const [csvText, setCsvText] = useState("");
  const [postForm, setPostForm] = useState({
    postedAt: new Date().toISOString().slice(0, 16),
    views: "",
    saves: "",
    shares: "",
    linkClicks: "",
    notes: "",
  });
  const [pitchDraft, setPitchDraft] = useState<PitchDraft>({
    trackName: project.name,
    genre: "Tech house / electronic",
    bpm: "128",
    hook: "",
    comparisonArtists: "",
    privateLink: "",
    bookingUrl: project.bookingUrl,
  });

  const growth = project.growthData;
  const links = useMemo(() => getGrowthIntegrationLinks(), []);

  const playlistCounts = useMemo(
    () => countByStatus(growth.playlistSubmissions),
    [growth.playlistSubmissions]
  );
  const labelCounts = useMemo(
    () => countByStatus(growth.labelSubmissions),
    [growth.labelSubmissions]
  );

  const socialWindows = useMemo(
    () =>
      recommendPostWindows(
        socialPlatform,
        growth.socialPosts
          .filter((post) => post.platform === socialPlatform)
          .map((post) => ({ postedAt: post.postedAt, views: post.views }))
      ),
    [growth.socialPosts, socialPlatform]
  );

  const pitchText = useMemo(() => buildPitchText(pitchDraft), [pitchDraft]);

  async function persistGrowth(nextGrowth: typeof growth, successMessage: string) {
    setBusy(true);
    onError(null);
    onMessage(null);
    try {
      const updated = await api.updateProject(project.id, { growthData: nextGrowth });
      if (!updated) {
        throw new Error("Project not found");
      }
      onProjectUpdated(updated);
      onMessage(successMessage);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save growth data");
    } finally {
      setBusy(false);
    }
  }

  async function addStarterPlaylists() {
    const now = new Date().toISOString();
    const next = addCuratedPlaylistTargets(
      growth,
      project.id,
      CURATED_PLAYLISTS.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        platform: playlist.platform,
        contactUrl: playlist.contactUrl,
      })),
      now,
      createId
    );
    await persistGrowth(next, "KillsComfort playlist targets added to your tracker.");
  }

  async function addStarterLabels() {
    const now = new Date().toISOString();
    const next = addCuratedLabelTargets(
      growth,
      project.id,
      CURATED_LABELS.map((label) => ({
        id: label.id,
        name: label.name,
        contactUrl: label.contactUrl,
      })),
      now,
      createId
    );
    await persistGrowth(next, "KillsComfort label targets added to your tracker.");
  }

  async function updatePlaylist(row: PlaylistSubmission) {
    await persistGrowth(
      upsertPlaylistSubmission(growth, {
        ...row,
        updatedAt: new Date().toISOString(),
      }),
      "Playlist submission updated."
    );
  }

  async function updateLabel(row: LabelSubmission) {
    await persistGrowth(
      upsertLabelSubmission(growth, {
        ...row,
        updatedAt: new Date().toISOString(),
      }),
      "Label submission updated."
    );
  }

  async function logSocialPost() {
    const now = new Date().toISOString();
    const postedAt = postForm.postedAt
      ? new Date(postForm.postedAt).toISOString()
      : now;
    const next = upsertSocialPost(growth, {
      id: createId(),
      projectId: project.id,
      platform: socialPlatform,
      postedAt,
      views: Number(postForm.views) || 0,
      saves: Number(postForm.saves) || 0,
      shares: Number(postForm.shares) || 0,
      linkClicks: Number(postForm.linkClicks) || 0,
      notes: postForm.notes.trim(),
      taskId: null,
    });
    await persistGrowth(next, "Social post logged.");
    setPostForm({
      postedAt: new Date().toISOString().slice(0, 16),
      views: "",
      saves: "",
      shares: "",
      linkClicks: "",
      notes: "",
    });
  }

  async function importCsv() {
    const rows = parseSocialPostsCsv(csvText);
    if (rows.length === 0) {
      onError("No rows found. Use headers: platform, date, views, saves, shares, link clicks, notes.");
      return;
    }
    let next = growth;
    for (const row of rows) {
      next = upsertSocialPost(next, {
        id: createId(),
        projectId: project.id,
        platform: row.platform,
        postedAt: row.postedAt,
        views: row.views,
        saves: row.saves,
        shares: row.shares,
        linkClicks: row.linkClicks,
        notes: row.notes,
        taskId: null,
      });
    }
    await persistGrowth(next, `Imported ${rows.length} social posts.`);
    setCsvText("");
  }

  return (
    <div className="panel-card growth-hub">
      <div className="growth-hub-header">
        <div>
          <h2 className="section-title">Growth hub</h2>
          <p className="page-subtitle">
            Playlisting, labels, and social analytics for electronic / DJ releases.
          </p>
        </div>
        <div className="growth-hub-tabs" role="tablist" aria-label="Growth hub sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "social"}
            className={`button ghost${tab === "social" ? " active" : ""}`}
            onClick={() => setTab("social")}
          >
            Social
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "playlists"}
            className={`button ghost${tab === "playlists" ? " active" : ""}`}
            onClick={() => setTab("playlists")}
          >
            Playlists
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "labels"}
            className={`button ghost${tab === "labels" ? " active" : ""}`}
            onClick={() => setTab("labels")}
          >
            Labels
          </button>
        </div>
      </div>

      {tab === "social" ? (
        <div className="growth-section">
          <div className="growth-stats-row">
            <span>{growth.socialPosts.length} posts logged</span>
            <a
              className="text-link"
              href={analyticsLinkForPlatform(socialPlatform, links)}
              target="_blank"
              rel="noreferrer"
            >
              Open {SOCIAL_PLATFORM_LABELS[socialPlatform]} analytics
            </a>
          </div>

          <label>
            Platform
            <select
              value={socialPlatform}
              onChange={(event) => setSocialPlatform(event.target.value as SocialPlatform)}
            >
              {SOCIAL_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {SOCIAL_PLATFORM_LABELS[platform]}
                </option>
              ))}
            </select>
          </label>

          <div className="growth-window-list">
            <h3 className="subsection-title">Recommended post windows</h3>
            <p className="page-subtitle">
              KillsComfort defaults until you log 3+ posts on this platform.
            </p>
            <ul>
              {socialWindows.map((window) => (
                <li key={`${window.day}-${window.hour}`}>
                  {window.day} {formatHour(window.hour)} — score {window.score}
                </li>
              ))}
            </ul>
          </div>

          <div className="form-grid">
            <label>
              Posted at
              <input
                type="datetime-local"
                value={postForm.postedAt}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, postedAt: event.target.value }))
                }
              />
            </label>
            <label>
              Views
              <input
                inputMode="numeric"
                value={postForm.views}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, views: event.target.value }))
                }
              />
            </label>
            <label>
              Saves
              <input
                inputMode="numeric"
                value={postForm.saves}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, saves: event.target.value }))
                }
              />
            </label>
            <label>
              Shares
              <input
                inputMode="numeric"
                value={postForm.shares}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, shares: event.target.value }))
                }
              />
            </label>
            <label>
              Link clicks
              <input
                inputMode="numeric"
                value={postForm.linkClicks}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, linkClicks: event.target.value }))
                }
              />
            </label>
            <label>
              Notes
              <input
                value={postForm.notes}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Hook, sound, or task reference"
              />
            </label>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void logSocialPost()}
            >
              Log post
            </button>
          </div>

          <label>
            Import CSV
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder="platform,date,views,saves,shares,link clicks,notes"
              rows={4}
            />
          </label>
          <div className="toolbar">
            <button
              type="button"
              className="button"
              disabled={busy || !csvText.trim()}
              onClick={() => void importCsv()}
            >
              Import rows
            </button>
          </div>

          {growth.socialPosts.length > 0 ? (
            <div className="task-table-wrap">
              <table className="task-table growth-table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Posted</th>
                    <th>Views</th>
                    <th>Saves</th>
                    <th>Shares</th>
                    <th>Clicks</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {growth.socialPosts.map((post) => (
                    <tr key={post.id}>
                      <td>{SOCIAL_PLATFORM_LABELS[post.platform]}</td>
                      <td>{new Date(post.postedAt).toLocaleString()}</td>
                      <td>{post.views}</td>
                      <td>{post.saves}</td>
                      <td>{post.shares}</td>
                      <td>{post.linkClicks}</td>
                      <td>{post.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "playlists" ? (
        <div className="growth-section">
          <div className="growth-stats-row">
            <span>
              {playlistCounts.to_submit} to submit · {playlistCounts.submitted} submitted ·{" "}
              {playlistCounts.added} added
            </span>
            <a className="text-link" href={links.submitHub} target="_blank" rel="noreferrer">
              Open SubmitHub
            </a>
          </div>

          <div className="toolbar">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void addStarterPlaylists()}
            >
              Add KillsComfort starter playlists
            </button>
          </div>

          <details className="growth-details">
            <summary>Curated playlist directory ({CURATED_PLAYLISTS.length})</summary>
            <ul className="growth-directory">
              {CURATED_PLAYLISTS.map((playlist) => (
                <li key={playlist.id}>
                  <strong>{playlist.name}</strong> — {playlist.genre} ({playlist.followerRange})
                  <br />
                  {playlist.notes}
                </li>
              ))}
            </ul>
          </details>

          {growth.playlistSubmissions.length > 0 ? (
            <div className="task-table-wrap">
              <table className="task-table growth-table">
                <thead>
                  <tr>
                    <th>Playlist</th>
                    <th>Platform</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {growth.playlistSubmissions.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.platform}</td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(event) =>
                            void updatePlaylist({
                              ...row,
                              status: event.target.value as SubmissionStatus,
                              submittedAt:
                                event.target.value === "submitted" && !row.submittedAt
                                  ? new Date().toISOString()
                                  : row.submittedAt,
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {SUBMISSION_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={row.notes}
                          onChange={(event) =>
                            void updatePlaylist({ ...row, notes: event.target.value })
                          }
                        />
                      </td>
                      <td className="growth-links">
                        <a href={row.contactUrl} target="_blank" rel="noreferrer">
                          Contact
                        </a>
                        <a
                          href={submitHubLinkForPlaylist(row.name)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          SubmitHub
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="page-subtitle">Add starter playlists to begin tracking submissions.</p>
          )}
        </div>
      ) : null}

      {tab === "labels" ? (
        <div className="growth-section">
          <div className="growth-stats-row">
            <span>
              {labelCounts.to_submit} to pitch · {labelCounts.submitted} sent ·{" "}
              {labelCounts.added} signed
            </span>
            <a className="text-link" href={links.submitHub} target="_blank" rel="noreferrer">
              Open SubmitHub
            </a>
          </div>

          <div className="toolbar">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void addStarterLabels()}
            >
              Add KillsComfort starter labels
            </button>
          </div>

          <details className="growth-details">
            <summary>Label education ({CURATED_LABELS.length} targets)</summary>
            <ul className="growth-directory">
              {CURATED_LABELS.map((label) => (
                <li key={label.id}>
                  <strong>{label.name}</strong> — {label.genre}
                  <br />
                  {label.notes} Pitch timing: {label.whenToPitch}
                </li>
              ))}
            </ul>
          </details>

          <h3 className="subsection-title">Pitch draft</h3>
          <div className="form-grid">
            <label>
              Track name
              <input
                value={pitchDraft.trackName}
                onChange={(event) =>
                  setPitchDraft((current) => ({ ...current, trackName: event.target.value }))
                }
              />
            </label>
            <label>
              Genre
              <input
                value={pitchDraft.genre}
                onChange={(event) =>
                  setPitchDraft((current) => ({ ...current, genre: event.target.value }))
                }
              />
            </label>
            <label>
              BPM
              <input
                value={pitchDraft.bpm}
                onChange={(event) =>
                  setPitchDraft((current) => ({ ...current, bpm: event.target.value }))
                }
              />
            </label>
            <label>
              Hook
              <input
                value={pitchDraft.hook}
                onChange={(event) =>
                  setPitchDraft((current) => ({ ...current, hook: event.target.value }))
                }
              />
            </label>
            <label>
              Sounds like
              <input
                value={pitchDraft.comparisonArtists}
                onChange={(event) =>
                  setPitchDraft((current) => ({
                    ...current,
                    comparisonArtists: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Private link
              <input
                value={pitchDraft.privateLink}
                onChange={(event) =>
                  setPitchDraft((current) => ({ ...current, privateLink: event.target.value }))
                }
              />
            </label>
          </div>
          <pre className="growth-pitch-preview">{pitchText}</pre>
          <div className="toolbar">
            <button
              type="button"
              className="button"
              onClick={() => void navigator.clipboard.writeText(pitchText)}
            >
              Copy pitch
            </button>
          </div>

          {growth.labelSubmissions.length > 0 ? (
            <div className="task-table-wrap">
              <table className="task-table growth-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {growth.labelSubmissions.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(event) =>
                            void updateLabel({
                              ...row,
                              status: event.target.value as SubmissionStatus,
                              submittedAt:
                                event.target.value === "submitted" && !row.submittedAt
                                  ? new Date().toISOString()
                                  : row.submittedAt,
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {SUBMISSION_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={row.notes}
                          onChange={(event) =>
                            void updateLabel({ ...row, notes: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <a href={row.contactUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="page-subtitle">Add starter labels to track demo pitches.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
