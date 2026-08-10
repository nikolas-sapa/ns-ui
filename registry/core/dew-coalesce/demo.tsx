"use client";

import { DewCoalesce } from "./component";

// Inline "tray/inbox" glyph so the component keeps zero deps.
function TrayMark() {
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
      <path d="M3 12h4l2 3h6l2-3h4" />
      <path d="M5.5 6h13l2 6.5V18a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-5.5L5.5 6Z" />
    </svg>
  );
}

export default function DewCoalesceDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / dew-coalesce — condensation on cold glass
      </p>
      <DewCoalesce
        className="h-[380px] w-full max-w-md"
        icon={<TrayMark />}
        title="Inbox zero"
        description="New messages will appear here as they arrive."
        actionLabel="Compose a message"
      />
    </div>
  );
}
