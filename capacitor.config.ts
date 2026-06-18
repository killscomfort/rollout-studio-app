import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rolloutstudio.app",
  appName: "Rollout Studio",
  webDir: "client/dist",
  ios: {
    contentInset: "automatic",
    backgroundColor: "#8ec9f5",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
