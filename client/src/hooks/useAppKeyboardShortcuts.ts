import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

interface AppKeyboardShortcutsOptions {
  onBack?: () => void;
  onForward?: () => void;
  onAllProjects?: () => void;
  onOpenWidget?: () => void;
  onReload?: () => void;
}

export function useAppKeyboardShortcuts({
  onBack,
  onForward,
  onAllProjects,
  onOpenWidget,
  onReload,
}: AppKeyboardShortcutsOptions) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (event.key === "[") {
        event.preventDefault();
        onBack?.();
        return;
      }
      if (event.key === "]") {
        event.preventDefault();
        onForward?.();
        return;
      }
      if (event.key === "1") {
        event.preventDefault();
        onAllProjects?.();
        return;
      }
      if (event.shiftKey && event.key.toLowerCase() === "w") {
        event.preventDefault();
        onOpenWidget?.();
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        onReload?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAllProjects, onBack, onForward, onOpenWidget, onReload]);
}
