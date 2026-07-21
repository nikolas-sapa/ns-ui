"use client";

import { FallowPanel } from "./component";

// Lucide-style "plus in a square" — inlined so the component keeps zero deps
function AddMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export default function FallowPanelDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / fallow-panel — an empty list
      </p>
      <FallowPanel
        className="w-full max-w-md"
        icon={<AddMark />}
        title="No projects yet"
        description="Projects you create will be listed here, newest first."
        actionLabel="Create a project"
      />
    </div>
  );
}
