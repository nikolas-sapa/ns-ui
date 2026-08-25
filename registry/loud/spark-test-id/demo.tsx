"use client";

import { useState } from "react";
import { SparkTestId, type SparkTestIdFile } from "./component";

export default function SparkTestIdDemo() {
  const [file, setFile] = useState<SparkTestIdFile | null>(null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / spark-test-id — drop a file, read its spark stream
      </p>

      <div className="w-full max-w-lg rounded-md border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground">Identify a specimen</h2>
        <p className="mt-1 mb-5 text-sm text-ns-muted">
          The wheel runs a low idle shower at rest. Drop or select a file and its
          detected type sets a characteristic spark signature — burst count, fork
          depth, carrier length — the same way a machinist reads an unknown steel
          grade off a bench grinder.
        </p>
        <SparkTestId
          aria-label="Upload a file to identify its type"
          accept={[".png", ".jpg", ".pdf", ".zip", ".mp4", ".txt", ".json"]}
          maxSizeBytes={16 * 1024 * 1024}
          onFileChange={setFile}
        />
        <p className="mt-4 font-mono text-xs text-ns-muted">
          {file ? `last identified: ${file.name} (${file.type || "unknown"})` : "no specimen yet"}
        </p>
      </div>
    </div>
  );
}
