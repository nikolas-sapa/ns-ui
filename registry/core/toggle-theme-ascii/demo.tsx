"use client";

import { ThemeToggleAscii } from "./component";

export default function ThemeToggleAsciiDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / toggle-theme-ascii
      </p>
      <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-surface px-10 py-8">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
          appearance
        </span>
        <ThemeToggleAscii />
      </div>
      <p className="max-w-md text-center text-xs text-muted">
        The chip is painted in the negative of the current theme's real
        token colors — it previews almost exactly what the page will look
        like the instant you click it.
      </p>
    </div>
  );
}
