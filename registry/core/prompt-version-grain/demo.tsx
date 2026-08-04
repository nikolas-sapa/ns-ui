"use client";

import { PromptVersionGrain } from "./component";
import type { PromptGrainBlock, PromptGrainVersion } from "./component";

// Twelve releases of one production support-triage system prompt, newest first.
// Static data, so the server render and the client hydration agree.

const BLOCKS: PromptGrainBlock[] = [
  { id: "system", label: "system" },
  { id: "persona", label: "persona" },
  { id: "tools", label: "tools" },
  { id: "rules", label: "rules" },
  { id: "examples", label: "examples" },
  { id: "format", label: "format" },
];

/** Row index (0 = newest, v37) -> blocks changed in that release. */
const CHANGED: string[][] = [
  ["tools"],
  ["tools", "rules", "examples"],
  ["persona", "tools"],
  ["tools", "rules"],
  ["tools", "rules"],
  ["tools"],
  ["tools", "rules"],
  ["persona", "tools"],
  ["rules"],
  [],
  ["rules"],
  [],
];

const TOKENS = [
  1840, 1788, 1745, 1702, 1664, 1611, 1580, 1524, 1498, 1440, 1402, 1361,
];

const VERSIONS: PromptGrainVersion[] = CHANGED.map((ids, r) => ({
  id: `v${37 - r}`,
  label: `v${37 - r}`,
  tokens: TOKENS[r]!,
  changed: Object.fromEntries(BLOCKS.map((b) => [b.id, ids.includes(b.id)])),
}));

export default function PromptVersionGrainDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / prompt-version-grain
      </p>

      <div
        data-grain-card=""
        className="w-full max-w-lg rounded-[12px] border border-border bg-background px-7 pb-7 pt-6"
      >
        <div className="mb-5 flex items-baseline justify-between gap-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
            support-triage / system prompt
          </h2>
          <span className="font-mono text-[10px] tabular-nums text-muted">
            12 releases · v26 → v37
          </span>
        </div>
        <PromptVersionGrain
          blocks={BLOCKS}
          versions={VERSIONS}
          ariaLabel="Prompt blocks changed in each of the last twelve releases"
        />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Which prompt blocks changed in each of the last twelve releases.
      </p>
    </div>
  );
}
