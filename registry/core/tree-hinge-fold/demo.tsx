"use client";

import { FoldingRule, type RuleNode } from "./component";

// Hoisted so the tree isn't handed a new node-array identity every render.
const NODES: RuleNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "components",
        label: "components",
        children: [
          { id: "button", label: "button.tsx" },
          { id: "dialog", label: "dialog.tsx" },
          { id: "tabs", label: "tabs.tsx" },
        ],
      },
      {
        id: "lib",
        label: "lib",
        children: [
          { id: "utils", label: "utils.ts" },
          { id: "tokens", label: "tokens.ts" },
        ],
      },
      { id: "index", label: "index.ts" },
    ],
  },
  {
    id: "scripts",
    label: "scripts",
    children: [
      { id: "build", label: "build.ts" },
      { id: "verify", label: "verify.ts" },
    ],
  },
  { id: "package", label: "package.json" },
  { id: "readme", label: "README.md" },
];

export default function FoldingRuleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / folding-rule — branches swing open on a hinge
      </p>
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-3">
        <FoldingRule nodes={NODES} defaultExpanded={["src", "components"]} />
      </div>
    </div>
  );
}
