"use client";

import { ChaffWinnow } from "./component";

const ITEMS = [
  { id: "grep", label: "grep", hint: "search text" },
  { id: "rg", label: "ripgrep", hint: "search text, fast" },
  { id: "sed", label: "sed", hint: "stream edit" },
  { id: "awk", label: "awk", hint: "field processing" },
  { id: "jq", label: "jq", hint: "query JSON" },
  { id: "cut", label: "cut", hint: "slice columns" },
  { id: "sort", label: "sort", hint: "order lines" },
  { id: "uniq", label: "uniq", hint: "dedupe lines" },
  { id: "xargs", label: "xargs", hint: "build arg lists" },
  { id: "tr", label: "tr", hint: "translate chars" },
];

export default function ChaffWinnowDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / chaff-winnow
        </p>
        <ChaffWinnow label="Search unix tools" placeholder="Filter tools…" items={ITEMS} />
        <p className="mt-3 font-mono text-[11px] text-muted">
          non-matches tumble aside and their slots close behind them — clear
          the query and the chaff settles back
        </p>
      </div>
    </main>
  );
}
