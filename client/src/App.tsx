import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import { initAppData, isSupabaseConfigured, onAuthStateChange, subscribeToCloudChanges } from "./api";
import { getSession } from "./lib/supabase";
import { AuthPage } from "./pages/AuthPage";
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
  const [signedIn, setSignedIn] = useState<boolean | null>(
    isSupabaseConfigured() ? null : true
  );
  const [view, setView] = useState<View>("list");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured() || widgetMode) return;

    void getSession().then((session) => {
      setSignedIn(Boolean(session));
    });

    return onAuthStateChange((next) => {
      if (next) {
        void initAppData().finally(() => setSignedIn(true));
        return;
      }
      setSignedIn(false);
    });
  }, [widgetMode]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !signedIn || widgetMode) return;
    return subscribeToCloudChanges(() => {
      setRefreshKey((value) => value + 1);
      setWorkspaceKey((value) => value + 1);
    });
  }, [signedIn, widgetMode]);

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
          key={refreshKey}
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
          key={refreshKey}
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

  if (signedIn === null && !widgetMode) {
    return <div className="empty-state">Loading account…</div>;
  }

  if (!signedIn && !widgetMode) {
    return <AuthPage onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <div className={widgetMode ? "widget-root" : "app-shell"}>{content}</div>
  );
}
