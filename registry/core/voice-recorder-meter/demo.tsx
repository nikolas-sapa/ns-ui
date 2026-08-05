"use client";

import { useState } from "react";
import { ReedVu } from "./component";

// Rests idle — the mic is never touched until the visitor clicks the chip
// themselves. onCapture below stands in for a real upload/transcription
// call: it reports how long the capture ran and nothing else. It never
// fabricates transcript text, because this component doesn't have any.
export default function ReedVuDemo() {
  const [log, setLog] = useState<string[]>([]);

  const handleCapture = async (durationMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const seconds = (durationMs / 1000).toFixed(1);
    setLog((prev) => [`Captured ${seconds}s — queued for transcription`, ...prev].slice(0, 4));
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-full max-w-md rounded-md border border-border bg-background p-5 shadow-sm">
        <h2 className="text-sm font-medium text-foreground">New note</h2>
        <p className="mt-1 text-xs text-ns-muted">Dictate or type — both land in the same field.</p>

        <textarea
          rows={3}
          placeholder="Start typing, or record a voice note below…"
          className="mt-4 w-full resize-none rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        />

        <div className="mt-4">
          <ReedVu label="Voice note" onCapture={handleCapture} />
        </div>

        {log.length ? (
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-ns-muted">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / voice-recorder-meter — real levels, or an honest error, never fake bars
      </p>
    </div>
  );
}
