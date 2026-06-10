import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rolloutstudio.app",
  appName: "Rollout Studio",
  webDir: "client/dist",
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0f1115",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
