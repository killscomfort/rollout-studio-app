import { useMemo, useState } from "react";
import { ProjectListPage } from "./pages/ProjectListPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";

type View = "list" | "workspace" | "settings";

export default function App() {
  const [view, setView] = useState<View>("list");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState(0);

  const content = useMemo(() => {
    if (view === "list") {
      return (
        <ProjectListPage
          onOpenProject={(id) => {
            setProjectId(id);
            setView("workspace");
          }}
        />
      );
    }

    if (!projectId) {
      return <ProjectListPage onOpenProject={(id) => setProjectId(id)} />;
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
  }, [projectId, view, workspaceKey]);

  return <div className="app-shell">{content}</div>;
}
