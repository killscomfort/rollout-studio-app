export interface GrowthIntegrationLinks {
  submitHub: string;
  spotifyPitch: string;
  soundcloud: string;
  youtubeStudio: string;
  instagramInsights: string;
  tiktokAnalytics: string;
}

const DEFAULT_LINKS: GrowthIntegrationLinks = {
  submitHub: "https://www.submithub.com/",
  spotifyPitch:
    "https://artists.spotify.com/c/music/spotify-for-artists/pitching/",
  soundcloud: "https://soundcloud.com/you/stats",
  youtubeStudio: "https://studio.youtube.com/",
  instagramInsights: "https://www.instagram.com/accounts/insights/",
  tiktokAnalytics: "https://www.tiktok.com/creator-center/analytics",
};

export function getGrowthIntegrationLinks(): GrowthIntegrationLinks {
  return {
    submitHub:
      import.meta.env.VITE_SUBMITHUB_URL?.trim() || DEFAULT_LINKS.submitHub,
    spotifyPitch:
      import.meta.env.VITE_SPOTIFY_PITCH_URL?.trim() || DEFAULT_LINKS.spotifyPitch,
    soundcloud:
      import.meta.env.VITE_SOUNDCLOUD_URL?.trim() || DEFAULT_LINKS.soundcloud,
    youtubeStudio:
      import.meta.env.VITE_YOUTUBE_STUDIO_URL?.trim() || DEFAULT_LINKS.youtubeStudio,
    instagramInsights:
      import.meta.env.VITE_INSTAGRAM_INSIGHTS_URL?.trim() ||
      DEFAULT_LINKS.instagramInsights,
    tiktokAnalytics:
      import.meta.env.VITE_TIKTOK_ANALYTICS_URL?.trim() ||
      DEFAULT_LINKS.tiktokAnalytics,
  };
}

export function submitHubLinkForPlaylist(playlistName: string) {
  const base = getGrowthIntegrationLinks().submitHub;
  const url = new URL(base, window.location.origin);
  if (!url.searchParams.has("q")) {
    url.searchParams.set("q", playlistName);
  }
  return url.toString();
}

export const GROWTH_LINK_LABELS: Array<{
  key: keyof GrowthIntegrationLinks;
  label: string;
}> = [
  { key: "submitHub", label: "SubmitHub" },
  { key: "spotifyPitch", label: "Spotify for Artists (pitch)" },
  { key: "soundcloud", label: "SoundCloud stats" },
  { key: "youtubeStudio", label: "YouTube Studio" },
  { key: "instagramInsights", label: "Instagram insights" },
  { key: "tiktokAnalytics", label: "TikTok analytics" },
];
