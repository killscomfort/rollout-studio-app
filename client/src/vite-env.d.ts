/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_ROLLOUT_BACKEND: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
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
