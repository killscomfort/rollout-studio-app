import { Capacitor } from "@capacitor/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initAppData } from "./api";
import { useCloudBackend } from "./lib/config";
import { getSession } from "./lib/supabase";
import "./styles.css";

async function boot() {
  try {
    if (Capacitor.isNativePlatform()) {
      document.body.classList.add("native-mobile");
    }

    if (useCloudBackend()) {
      const session = await getSession();
      if (session) {
        await initAppData();
      }
    } else if (Capacitor.isNativePlatform()) {
      await initAppData();
    }

    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (error) {
    const root = document.getElementById("root");
    const message = error instanceof Error ? error.message : "Failed to start Rollout Studio";
    if (root) {
      root.innerHTML = `<div class="empty-state">${message}</div>`;
    }
    console.error(error);
  }
}

void boot();
