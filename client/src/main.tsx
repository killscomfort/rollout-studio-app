import { Capacitor } from "@capacitor/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initAppData } from "./api";
import { isSupabaseConfigured } from "./lib/config";
import { getSession } from "./lib/supabase";
import "./styles.css";

async function boot() {
  if (Capacitor.isNativePlatform()) {
    document.body.classList.add("native-mobile");
  }

  if (isSupabaseConfigured()) {
    const session = await getSession();
    if (session) {
      await initAppData();
    }
  } else if (Capacitor.isNativePlatform()) {
    await initAppData();
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void boot();
