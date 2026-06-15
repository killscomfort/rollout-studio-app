import type { ReactNode } from "react";
import { OpenWidgetButton } from "./OpenWidgetButton";

interface AppNavBarProps {
  title: string;
  subtitle?: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  actions?: ReactNode;
}

export function AppNavBar({
  title,
  subtitle,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  actions,
}: AppNavBarProps) {
  const canReload = Boolean(window.rolloutStudio?.reloadApp);

  return (
    <div className="app-nav">
      <div className="app-nav-controls">
        <button
          type="button"
          className="button ghost app-nav-icon-button"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Go back"
          title="Back"
        >
          ←
        </button>
        <button
          type="button"
          className="button ghost app-nav-icon-button"
          onClick={onForward}
          disabled={!canGoForward}
          aria-label="Go forward"
          title="Forward"
        >
          →
        </button>
        <OpenWidgetButton className="button" />
        {canReload ? (
          <button
            type="button"
            className="button ghost"
            title="Reload app"
            onClick={() => void window.rolloutStudio?.reloadApp?.()}
          >
            Reload
          </button>
        ) : null}
      </div>

      <div className="app-nav-title-block">
        <div className="app-nav-title">{title}</div>
        {subtitle ? <div className="app-nav-subtitle">{subtitle}</div> : null}
      </div>

      {actions ? <div className="app-nav-actions">{actions}</div> : null}
    </div>
  );
}
