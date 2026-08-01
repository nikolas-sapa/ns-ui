"use client";

import { BoughIndex, type BoughNode } from "./component";

const TREE: BoughNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "components",
        label: "components",
        children: [
          { id: "button-tsx", label: "button.tsx" },
          { id: "card-tsx", label: "card.tsx" },
          { id: "input-tsx", label: "input.tsx" },
        ],
      },
      {
        id: "lib",
        label: "lib",
        children: [
          { id: "utils-ts", label: "utils.ts" },
          { id: "hooks-ts", label: "hooks.ts" },
        ],
      },
      { id: "app-tsx", label: "app.tsx" },
      { id: "index-ts", label: "index.ts" },
    ],
  },
  { id: "package-json", label: "package.json" },
  { id: "readme-md", label: "readme.md" },
];

export default function BoughIndexDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / bough-index
      </p>
      <div className="w-full max-w-md rounded-md border border-border bg-surface/60 p-6">
        <BoughIndex
          label="Project files"
          nodes={TREE}
          defaultExpandedIds={["src", "components"]}
        />
      </div>
      <p className="max-w-md text-center font-mono text-xs text-muted">
        arrow keys move · → expands · ← collapses · enter selects
      </p>
    </div>
  );
}
