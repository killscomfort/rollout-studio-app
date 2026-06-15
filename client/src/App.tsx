import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import { initAppData, isSupabaseConfigured, onAuthStateChange, subscribeToCloudChanges } from "./api";
import { getSession } from "./lib/supabase";
import { AppNavBar } from "./components/AppNavBar";
import { AuthPage } from "./pages/AuthPage";
import { ProjectListPage } from "./pages/ProjectListPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { WidgetPanel } from "./pages/WidgetPanel";
import { WidgetSkyBackground } from "./components/WidgetSkyBackground";

type View = "list" | "workspace" | "settings";

interface NavEntry {
  view: View;
  projectId: string | null;
}

const ACTIVE_PROJECT_KEY = "rollout-active-project-id";

function isWidgetMode() {
  if (Capacitor.isNativePlatform()) {
    return false;
  }
  return window.location.hash === "#widget";
}

function navTitle(view: View, projectTitle: string) {
  if (view === "list") return "Rollout Studio";
  if (view === "settings") return "Project settings";
  return projectTitle || "Rollout";
}

function navSubtitle(view: View, projectTitle: string) {
  if (view === "list") return "Your projects";
  if (view === "settings") return projectTitle || "Adjust branding and plan";
  return "Release checklist";
}

export default function App() {
  const widgetMode = isWidgetMode();
  const [signedIn, setSignedIn] = useState<boolean | null>(
    isSupabaseConfigured() ? null : true
  );
  const [navState, setNavState] = useState<{ history: NavEntry[]; index: number }>({
    history: [{ view: "list", projectId: null }],
    index: 0,
  });
  const [projectTitle, setProjectTitle] = useState("");
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const currentNav = navState.history[navState.index] ?? { view: "list", projectId: null };
  const view = currentNav.view;
  const projectId = currentNav.projectId;
  const canGoBack = navState.index > 0;
  const canGoForward = navState.index < navState.history.length - 1;

  function navigate(entry: NavEntry) {
    setNavState((prev) => {
      const history = [...prev.history.slice(0, prev.index + 1), entry];
      return { history, index: history.length - 1 };
    });
  }

  function goBack() {
    setNavState((prev) =>
      prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev
    );
  }

  function goForward() {
    setNavState((prev) =>
      prev.index < prev.history.length - 1
        ? { ...prev, index: prev.index + 1 }
        : prev
    );
  }

  function openProject(id: string) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    navigate({ view: "workspace", projectId: id });
  }

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
      openProject(match[1]);
      window.history.replaceState(null, "", window.location.pathname);
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [widgetMode]);

  useEffect(() => {
    if (widgetMode) return;

    function handleBack() {
      setNavState((prev) =>
        prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev
      );
    }

    function handleForward() {
      setNavState((prev) =>
        prev.index < prev.history.length - 1
          ? { ...prev, index: prev.index + 1 }
          : prev
      );
    }

    function handleProjects() {
      setProjectTitle("");
      setNavState({
        history: [{ view: "list", projectId: null }],
        index: 0,
      });
    }

    window.addEventListener("rollout-nav-back", handleBack);
    window.addEventListener("rollout-nav-forward", handleForward);
    window.addEventListener("rollout-nav-projects", handleProjects);

    return () => {
      window.removeEventListener("rollout-nav-back", handleBack);
      window.removeEventListener("rollout-nav-forward", handleForward);
      window.removeEventListener("rollout-nav-projects", handleProjects);
    };
  }, [widgetMode]);

  const content = useMemo(() => {
    if (widgetMode) {
      return <WidgetPanel key={refreshKey} />;
    }

    if (view === "list") {
      return (
        <ProjectListPage
          key={refreshKey}
          onOpenProject={openProject}
        />
      );
    }

    if (!projectId) {
      return (
        <ProjectListPage
          key={refreshKey}
          onOpenProject={openProject}
        />
      );
    }

    if (view === "settings") {
      return (
        <ProjectSettingsPage
          projectId={projectId}
          onPlanChanged={() => setWorkspaceKey((value) => value + 1)}
          onDeleted={() => {
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
            setProjectTitle("");
            navigate({ view: "list", projectId: null });
          }}
        />
      );
    }

    return (
      <ProjectWorkspace
        key={workspaceKey}
        projectId={projectId}
        onProjectLoaded={(project) => setProjectTitle(project.name)}
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
    <div className={widgetMode ? "widget-root" : "app-shell"}>
      {!widgetMode ? (
        <AppNavBar
          title={navTitle(view, projectTitle)}
          subtitle={navSubtitle(view, projectTitle)}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={goBack}
          onForward={goForward}
          actions={
            view === "workspace" && projectId ? (
              <button
                type="button"
                className="button"
                onClick={() => navigate({ view: "settings", projectId })}
              >
                Project settings
              </button>
            ) : null
          }
        />
      ) : null}
      {content}
    </div>
  );
}
