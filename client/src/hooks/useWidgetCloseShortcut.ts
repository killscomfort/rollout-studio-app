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

export function useWidgetCloseShortcut(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const isCloseKey =
        event.key === "Escape" ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w");

      if (!isCloseKey) return;

      event.preventDefault();
      void window.rolloutStudio?.closeWidget?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
