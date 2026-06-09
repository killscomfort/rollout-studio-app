import { Capacitor } from "@capacitor/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initLocalDatabase } from "./api";
import "./styles.css";

async function boot() {
  if (Capacitor.isNativePlatform()) {
    document.body.classList.add("native-mobile");
    await initLocalDatabase();
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void boot();
