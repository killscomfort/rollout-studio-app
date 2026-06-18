/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_ROLLOUT_BACKEND: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUBMITHUB_URL: string;
  readonly VITE_SPOTIFY_PITCH_URL: string;
  readonly VITE_SOUNDCLOUD_URL: string;
  readonly VITE_YOUTUBE_STUDIO_URL: string;
  readonly VITE_INSTAGRAM_INSIGHTS_URL: string;
  readonly VITE_TIKTOK_ANALYTICS_URL: string;
  readonly VITE_ADMIN_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  rolloutStudio?: {
    platform: string;
    isWidget: () => boolean;
    openMain: (projectId?: string) => Promise<void>;
    openWidget: () => Promise<void>;
    reloadApp: () => Promise<void>;
    closeWidget: () => Promise<void>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    quitApp: () => Promise<void>;
  };
}
