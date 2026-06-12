import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import { initAppData, isSupabaseConfigured, onAuthStateChange, subscribeToCloudChanges } from "./api";
import { getSession } from "./lib/supabase";
import { AuthPage } from "./pages/AuthPage";
import { ProjectListPage } from "./pages/ProjectListPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { WidgetPanel } from "./pages/WidgetPanel";
import { WidgetSkyBackground } from "./components/WidgetSkyBackground";

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
    if (!isSupabaseConfigured()) {
      setSignedIn(true);
      return;
    }

    void getSession()
      .then((session) => {
        setSignedIn(Boolean(session));
      })
      .catch(() => {
        setSignedIn(false);
      });

    return onAuthStateChange((next) => {
      if (next) {
        void initAppData()
          .then(() => setSignedIn(true))
          .catch(() => setSignedIn(false));
        return;
      }
      setSignedIn(false);
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !signedIn) return;
    return subscribeToCloudChanges(() => {
      setRefreshKey((value) => value + 1);
      setWorkspaceKey((value) => value + 1);
    });
  }, [signedIn]);

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
      return <WidgetPanel key={refreshKey} />;
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
          onPlanChanged={() => setWorkspaceKey((value) => value + 1)}
          onDeleted={() => {
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
            setProjectId(null);
            setView("list");
          }}
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
  }, [projectId, view, workspaceKey, refreshKey, widgetMode]);

  if (signedIn === null) {
    return (
      <div className={widgetMode ? "widget-root" : "app-shell"}>
        <div className="empty-state">Loading account…</div>
      </div>
    );
  }

  if (!signedIn && isSupabaseConfigured()) {
    if (widgetMode) {
      return (
        <div className="widget-root">
          <div className="widget-shell">
            <WidgetSkyBackground />
            <div className="widget-content">
              <div className="widget-header">
                <div className="widget-drag">
                  <div className="widget-kicker">Rollout widget</div>
                  <div className="widget-title">Sign in required</div>
                </div>
                <div className="widget-actions">
                  <button
                    type="button"
                    className="widget-icon-button widget-close-button"
                    title="Close widget"
                    aria-label="Close widget"
                    onClick={() => void window.rolloutStudio?.closeWidget?.()}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="widget-empty">
                Sign in through the full app, then reopen the widget to sync your
                checklist.
              </div>
              <div className="widget-footer">
                <button
                  type="button"
                  className="button primary widget-open-full"
                  onClick={() => window.rolloutStudio?.openMain()}
                >
                  Open full app
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <AuthPage onSignedIn={() => setSignedIn(true)} />;
  }

  return (
    <div className={widgetMode ? "widget-root" : "app-shell"}>{content}</div>
  );
}
