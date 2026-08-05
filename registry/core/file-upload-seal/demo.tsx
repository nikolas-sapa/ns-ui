"use client";

import { useState } from "react";
import { VacuumSeal, type VacuumSealFile } from "./component";

const DEFAULT_FILES = [
  { name: "brand-guidelines.pdf", size: 2_684_301, type: "application/pdf", status: "sealed" as const },
  { name: "hero-render-4k.mov", size: 41_230_000, type: "video/quicktime", status: "uploading" as const, progress: 0.58 },
  { name: "invoice-0042.pdf", size: 184_920, type: "application/pdf", status: "failed" as const },
];

export default function VacuumSealDemo() {
  const [files, setFiles] = useState<VacuumSealFile[] | null>(null);
  const count = files ? files.length : DEFAULT_FILES.length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / file-upload-seal — the gap between outline and card is the remaining upload
      </p>

      <div className="w-full max-w-lg rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">Asset delivery</h2>
          <p className="mt-1 text-sm text-ns-muted">
            Drop the final files for this deliverable. Each one seals shut as it
            finishes — no bar, just the file itself pulling taut.
          </p>
        </div>

        <div className="px-6 py-5">
          <VacuumSeal
            aria-label="Upload delivery files"
            accept={[]}
            maxSizeBytes={64 * 1024 * 1024}
            defaultFiles={DEFAULT_FILES}
            onFilesChange={setFiles}
          />
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-ns-muted">
            {count} {count === 1 ? "file" : "files"} · 1 failed, re-drop to retry
          </p>
          <button
            type="button"
            className="rounded-sm bg-foreground px-3 py-1.5 text-xs font-medium text-background outline-none transition-colors hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Send to client
          </button>
        </div>
      </div>

      <p className="max-w-lg text-center text-xs text-ns-muted">
        Drop or browse a file: a loose dashed outline appears 24px outside the
        card and pulls tight as it uploads, clicking shut with a small pucker
        at 100%. A failed upload relaxes back out with a wobble instead of
        vanishing a bar.
      </p>
    </div>
  );
}
