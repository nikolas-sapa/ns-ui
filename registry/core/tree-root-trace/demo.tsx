"use client";

import { TaprootTrace, type TaprootNode } from "./component";

const nodes: TaprootNode[] = [
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
  { id: "readme", label: "README.md" },
];

export default function TaprootTraceDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / tree-root-trace — the guide grows from the junction
      </p>
      <div className="w-full max-w-xs rounded-md border border-border bg-background p-3">
        <TaprootTrace label="Project files" nodes={nodes} defaultExpandedIds={["src"]} />
      </div>
    </div>
  );
}
