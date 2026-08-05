"use client";

import { useState } from "react";
import { UpdraftDropzone, type UpdraftFile } from "./component";

const DEFAULT_FILES = [
  { name: "gpu-fence-timeout.log", size: 48_562, type: "text/plain" },
  { name: "export-dialog.png", size: 1_284_301, type: "image/png" },
];

export default function UpdraftDropzoneDemo() {
  const [files, setFiles] = useState<UpdraftFile[] | null>(null);
  const count = files ? files.length : DEFAULT_FILES.length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / file-upload-thermal — accepted files rise, rejected files sink
      </p>

      <div className="w-full max-w-lg rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            New support ticket
          </h2>
          <p className="mt-1 text-sm text-ns-muted">
            Attach logs and screenshots for the render team. Drops ride the
            thermal into the queue; anything oversize or off-type sinks.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label
              htmlFor="ticket-subject"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Subject
            </label>
            <input
              id="ticket-subject"
              type="text"
              defaultValue="Renderer crashes at 80% of .mp4 export"
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-ns-muted hover:border-foreground/25 focus-visible:border-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent/30"
            />
          </div>

          <div>
            <label
              htmlFor="ticket-desc"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Description
            </label>
            <textarea
              id="ticket-desc"
              rows={3}
              defaultValue="Export dies with a GPU fence timeout on the 4090 build farm. Repro is deterministic on scenes over 4k frames. Crash log and the failing export dialog attached."
              className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-ns-muted hover:border-foreground/25 focus-visible:border-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent/30"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground">
              Attachments
            </p>
            <UpdraftDropzone
              aria-label="Add ticket attachments"
              accept={[".png", ".jpg", ".pdf", ".log", ".txt"]}
              maxSizeBytes={8 * 1024 * 1024}
              defaultFiles={DEFAULT_FILES}
              onFilesChange={setFiles}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-ns-muted">
            {count} {count === 1 ? "file" : "files"} attached · draft saved
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              Discard
            </button>
            <button
              type="button"
              className="rounded-sm bg-foreground px-3 py-1.5 text-xs font-medium text-background outline-none transition-colors hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Submit ticket
            </button>
          </div>
        </div>
      </div>

      <p className="max-w-lg text-center text-xs text-ns-muted">
        Drag files over the zone to stir up convection wisps. Accepted drops
        buoy off the drop point, sway, and squash-land in the rack; rejected
        files sink and fade. Focus a docked chip and press Delete to remove it.
      </p>
    </div>
  );
}
