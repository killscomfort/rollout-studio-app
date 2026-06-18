import curatedPlaylists from "../seed/curated-playlists.json";
import curatedLabels from "../seed/curated-labels.json";
import type { CuratedLabel, CuratedPlaylist } from "./types";

export const CURATED_PLAYLISTS = curatedPlaylists as CuratedPlaylist[];
export const CURATED_LABELS = curatedLabels as CuratedLabel[];

export function listCuratedPlaylists() {
  return CURATED_PLAYLISTS;
}

export function listCuratedLabels() {
  return CURATED_LABELS;
}

export function getCuratedPlaylist(id: string) {
  return CURATED_PLAYLISTS.find((playlist) => playlist.id === id) ?? null;
}

export function getCuratedLabel(id: string) {
  return CURATED_LABELS.find((label) => label.id === id) ?? null;
}
