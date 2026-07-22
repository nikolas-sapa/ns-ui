"use client";

import { CogRail, type CogRailNode } from "./component";

// "readme" is deliberately first and deliberately a leaf: it's the first
// focusable row in the tree, so it's whatever a generic "click the first
// interactive control" sanity pass would land on — and since it has no
// children, that click can only select it, never toggle anything else's
// expanded state out from under the gate/autoplay target below ("src").
const nodes: CogRailNode[] = [
  { id: "readme", label: "README.md" },
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "components",
        label: "components",
        children: [
          { id: "button-tsx", label: "Button.tsx" },
          { id: "input-tsx", label: "Input.tsx" },
          { id: "modal-tsx", label: "Modal.tsx" },
        ],
      },
      {
        id: "hooks",
        label: "hooks",
        children: [
          { id: "use-tree", label: "useTree.ts" },
          { id: "use-focus", label: "useFocus.ts" },
        ],
      },
      { id: "utils", label: "utils.ts" },
    ],
  },
  {
    id: "public",
    label: "public",
    children: [
      { id: "favicon", label: "favicon.ico" },
      { id: "index-html", label: "index.html" },
    ],
  },
  { id: "package-json", label: "package.json" },
];

export default function CogRailDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / cog-rail — the carriage rides the rail
      </p>
      <div className="w-full max-w-xs rounded-md border border-border bg-background p-3">
        <CogRail label="Project files" nodes={nodes} />
      </div>
    </div>
  );
}
