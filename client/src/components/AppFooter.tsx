const PRIVACY_URL =
  "https://github.com/killscomfort/rollout-studio-app/blob/main/PRIVACY.md";
const SUPPORT_URL = "https://killscomfort.com/book";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
        Support Rollout Studio
      </a>
      <span className="app-footer-sep">·</span>
      <a href={PRIVACY_URL} target="_blank" rel="noreferrer">
        Privacy
      </a>
      <span className="app-footer-sep">·</span>
      <a href="mailto:killscomfort@gmail.com">Contact</a>
      <span className="app-footer-sep">·</span>
      <span className="app-footer-hint">
        ⌘⇧W widget · Esc / ⌘W close · ⌘[ ⌘] navigate
      </span>
    </footer>
  );
}
