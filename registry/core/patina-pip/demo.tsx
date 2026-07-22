"use client";

import { useId, useState } from "react";
import { PatinaPip } from "./component";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// three realistic inbox sections at three real ages, so the demo shows all
// three tarnish stages resting side by side without anyone waiting around —
// plus a button that lands new mail on the section that's gone quietest,
// so the instant re-polish (ring -> solid fill, flare) is the one thing
// that actually moves.
export default function PatinaPipDemo() {
  const [now] = useState(() => Date.now());
  const [archive, setArchive] = useState({
    count: 6,
    newestTimestamp: now - 9 * 24 * HOUR,
  });

  const messagesId = useId();
  const updatesId = useId();
  const archiveId = useId();

  function landNewMail() {
    setArchive({ count: 15, newestTimestamp: Date.now() });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / patina-pip
        </p>
        <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Same shape, three different ages: a solid pip is fresh, a thin ring
          is a week gone quiet — no need to wait and watch to tell them apart.
        </p>

        <nav
          aria-label="Mail sections"
          className="mt-5 divide-y divide-border rounded-md border border-border"
        >
          <button
            type="button"
            aria-describedby={messagesId}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors duration-150 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span>Messages</span>
            <PatinaPip id={messagesId} count={3} newestTimestamp={now - 3 * MINUTE} />
          </button>
          <button
            type="button"
            aria-describedby={updatesId}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors duration-150 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span>Updates</span>
            <PatinaPip id={updatesId} count={12} newestTimestamp={now - 30 * HOUR} />
          </button>
          <button
            type="button"
            aria-describedby={archiveId}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors duration-150 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span>Archive</span>
            <PatinaPip
              id={archiveId}
              count={archive.count}
              newestTimestamp={archive.newestTimestamp}
            />
          </button>
        </nav>

        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="font-mono text-[11px] text-muted">
            archive has gone dormant — try it
          </span>
          <button
            type="button"
            data-ns-patina-land
            onClick={landNewMail}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            LAND NEW MAIL
          </button>
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          fill, ring weight and text tone move together — never color alone
        </p>
      </div>
    </main>
  );
}
