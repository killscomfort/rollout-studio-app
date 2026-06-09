import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import { ProjectListPage } from "./pages/ProjectListPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { WidgetPanel } from "./pages/WidgetPanel";

type View = "list" | "workspace" | "settings";

const ACTIVE_PROJECT_KEY = "rollout-active-project-id";

function isWidgetMode() {
  if (Capacitor.isNativePlatform()) {
    return false;
  }
  return window.location.hash === "#widget";
}

export default function App() {
  const widgetMode = isWidgetMode();
  const [view, setView] = useState<View>("list");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState(0);

  useEffect(() => {
    if (widgetMode) {
      document.body.classList.add("widget-mode");
      return () => document.body.classList.remove("widget-mode");
    }
  }, [widgetMode]);

  useEffect(() => {
    if (widgetMode) return;

    function openFromHash() {
      const match = window.location.hash.match(/^#open\/(.+)$/);
      if (!match) return;
      localStorage.setItem(ACTIVE_PROJECT_KEY, match[1]);
      setProjectId(match[1]);
      setView("workspace");
      window.history.replaceState(null, "", window.location.pathname);
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [widgetMode]);

  const content = useMemo(() => {
    if (widgetMode) {
      return <WidgetPanel />;
    }

    if (view === "list") {
      return (
        <ProjectListPage
          onOpenProject={(id) => {
            localStorage.setItem(ACTIVE_PROJECT_KEY, id);
            setProjectId(id);
            setView("workspace");
          }}
        />
      );
    }

    if (!projectId) {
      return (
        <ProjectListPage
          onOpenProject={(id) => {
            localStorage.setItem(ACTIVE_PROJECT_KEY, id);
            setProjectId(id);
            setView("workspace");
          }}
        />
      );
    }

    if (view === "settings") {
      return (
        <ProjectSettingsPage
          projectId={projectId}
          onBack={() => setView("workspace")}
          onSaved={() => setWorkspaceKey((value) => value + 1)}
        />
      );
    }

    return (
      <ProjectWorkspace
        key={workspaceKey}
        projectId={projectId}
        onBack={() => {
          setView("list");
          setProjectId(null);
        }}
        onOpenSettings={() => setView("settings")}
      />
    );
  }, [projectId, view, workspaceKey, widgetMode]);

  return (
    <div className={widgetMode ? "widget-root" : "app-shell"}>{content}</div>
  );
}
