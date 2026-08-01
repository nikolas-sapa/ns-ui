"use client";

import { useState } from "react";
import { ShadowBoard, type ShadowBoardItem } from "./component";

const SUBTITLES = [
  "Updated just now",
  "3 members",
  "No activity yet",
  "Draft",
];

export default function ShadowBoardDemo() {
  const [items, setItems] = useState<ShadowBoardItem[]>([]);

  function handleCreate() {
    setItems((prev) => {
      if (prev.length >= 4) return prev;
      const n = prev.length + 1;
      return [
        ...prev,
        { id: `project-${n}`, title: `Project ${n}`, subtitle: SUBTITLES[n - 1] },
      ];
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / shadow-board — an empty list that previews its own layout
      </p>
      <ShadowBoard
        className="max-w-md"
        items={items}
        slots={4}
        title="Projects"
        description="No projects yet. Created projects will appear here."
        createLabel="Create a project"
        onCreate={handleCreate}
      />
    </div>
  );
}
