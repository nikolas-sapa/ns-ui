"use client";

import { useState } from "react";
import { ShuntTray, type ShuntTrayItem } from "./component";

const FILE_ACTIONS: ShuntTrayItem[] = [
  { id: "rename", label: "Rename" },
  {
    id: "share",
    label: "Share",
    items: [
      { id: "share-link", label: "Copy link" },
      { id: "share-email", label: "Email" },
      {
        id: "share-slack",
        label: "Slack",
        items: [
          { id: "slack-general", label: "#general" },
          { id: "slack-eng", label: "#engineering" },
        ],
      },
    ],
  },
  {
    id: "move",
    label: "Move to",
    items: [
      { id: "move-projects", label: "Projects", hint: "12" },
      { id: "move-archive", label: "Archive", hint: "204" },
    ],
  },
  { id: "duplicate", label: "Duplicate" },
  { id: "delete", label: "Delete" },
];

export default function ShuntTrayDemo() {
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-6 py-20 text-foreground">
      <div className="w-full max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          ns-ui / shunt-tray
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Every ancestor stays on the rails
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Open Share, then Slack: the parent tray doesn&apos;t vanish behind a
          flyout, it shunts back and dims, leaving a 12px edge. Click any
          exposed edge to jump straight back to that level — or use
          ArrowRight/Enter to drill in and ArrowLeft/Escape to back out one
          level at a time.
        </p>

        <div className="mt-10 flex flex-wrap items-start gap-8">
          <ShuntTray
            label="File actions"
            items={FILE_ACTIONS}
            onSelect={(item) => setLastAction(item.label)}
          />

          <div className="max-w-xs pt-2 text-sm leading-relaxed text-muted">
            <p>
              <span className="font-medium text-foreground">Try it:</span>{" "}
              open <span className="text-foreground">Share</span> →{" "}
              <span className="text-foreground">Slack</span>, then click the
              thin left edge to shunt straight back to{" "}
              <span className="text-foreground">File actions</span> in one
              action instead of backing out twice.
            </p>
          </div>
        </div>

        <p className="mt-6 font-mono text-xs text-muted" aria-live="polite">
          {lastAction ? `selected → ${lastAction}` : "selected → nothing yet"}
        </p>
      </div>
    </div>
  );
}
