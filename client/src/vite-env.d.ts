/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  rolloutStudio?: {
    platform: string;
    isWidget: () => boolean;
    openMain: (projectId?: string) => Promise<void>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    quitApp: () => Promise<void>;
  };
}
