import { useRef, useState } from "react";
import type { SyncBundle } from "../../../shared/sync";
import { validateSyncBundle } from "../../../shared/sync";
import { api, useCloudBackend } from "../api";

interface SyncControlsProps {
  onSynced: () => void;
}

const SYNC_FILENAME = "rollout-studio-sync.json";

async function shareOrDownload(bundle: SyncBundle) {
  const json = JSON.stringify(bundle, null, 2);
  const file = new File([json], SYNC_FILENAME, { type: "application/json" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Rollout Studio sync",
    });
    return;
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = SYNC_FILENAME;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SyncControls({ onSynced }: SyncControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (useCloudBackend()) {
    return (
      <div className="panel-card sync-panel">
        <h2 className="section-title">Cloud sync</h2>
        <p className="sync-copy">
          Supabase is connected. Projects and checked tasks sync automatically
          across your Mac, iPhone, and any signed-in device.
        </p>
      </div>
    );
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const bundle = await api.exportSync();
      await shareOrDownload(bundle);
      setMessage("Sync file exported. Import it on your other device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const bundle = validateSyncBundle(JSON.parse(text));
      const result = await api.importSync(bundle);
      setMessage(
        `Sync complete: ${result.added} added, ${result.updated} updated, ${result.skipped} kept local.`
      );
      onSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="panel-card sync-panel">
      <h2 className="section-title">Sync devices</h2>
      <p className="sync-copy">
        Move projects and checked tasks between Mac and iPhone by exporting a sync
        file on one device and importing it on the other. Newer project edits win;
        checked tasks merge when both copies exist.
      </p>

      {message ? <div className="callout success">{message}</div> : null}
      {error ? <div className="callout">{error}</div> : null}

      <div className="toolbar">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void handleExport()}
        >
          Export sync file
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          Import sync file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImportFile(file);
            }
          }}
        />
      </div>
    </div>
  );
}
