"use client";

import { PromptVersionGrain } from "./component";
import type { PromptGrainBlock, PromptGrainVersion } from "./component";

// Twelve releases of one production system prompt, newest first. All data is
// deterministic (no Math.random(), no Date.now()) so the server render and the
// client hydration agree byte for byte.
//
// The shape of the data is the point of the demo:
//   system   — never touched in twelve releases  -> one unbroken fiber
//   format   — never touched                     -> one unbroken fiber
//   persona  — rewritten twice                   -> three long segments
//   tools    — rewritten nearly every release    -> a ladder of short segments
//   rules    — rewritten six times               -> a ladder
//   examples — introduced six releases ago       -> a fiber that stops halfway

const N = 12;

const BLOCKS: PromptGrainBlock[] = [
  { id: "system", label: "system" },
  { id: "persona", label: "persona" },
  { id: "tools", label: "tools" },
  { id: "rules", label: "rules" },
  { id: "examples", label: "examples" },
  { id: "format", label: "format" },
];

/** Rows (0 = newest) whose boundary with the row BELOW carries a change. */
const CHANGED_AT: Record<string, number[]> = {
  system: [],
  persona: [2, 7],
  tools: [0, 1, 2, 3, 4, 5, 6, 7],
  rules: [1, 3, 4, 6, 8, 10],
  examples: [1],
  format: [],
};

/** Blocks absent from a version, by row index. `examples` only exists in the
 *  six most recent releases; below that the column is honestly empty. */
const ABSENT_FROM_ROW: Record<string, number> = { examples: 6 };

const BASE_TOKENS: Record<string, number> = {
  system: 214,
  persona: 168,
  tools: 402,
  rules: 296,
  examples: 248,
  format: 96,
};

/** Hash that only changes when it crosses one of the block's change rows, so
 *  equality between adjacent rows is exactly "this block was untouched". */
function stepHash(id: string, row: number): string {
  const rows = CHANGED_AT[id] ?? [];
  const step = rows.filter((r) => r < row).length;
  return `${id}-${step}`;
}

const VERSIONS: PromptGrainVersion[] = Array.from({ length: N }, (_, r) => {
  const cells: PromptGrainVersion["cells"] = {};
  for (const b of BLOCKS) {
    const absentFrom = ABSENT_FROM_ROW[b.id];
    if (absentFrom !== undefined && r >= absentFrom) {
      cells[b.id] = null;
      continue;
    }
    const changed = (CHANGED_AT[b.id] ?? []).includes(r);
    cells[b.id] = {
      hash: stepHash(b.id, r),
      tokens: BASE_TOKENS[b.id]! - r * 4 + ((r * 13) % 11),
      ...(changed
        ? { added: 12 + ((r * 17) % 40), removed: 4 + ((r * 11) % 20) }
        : {}),
    };
  }
  return {
    id: `v${37 - r}`,
    label: `v${37 - r}`,
    tokens: 1840 - r * 52 + ((r * 7) % 3) * 9,
    score: Number((0.94 - r * 0.017 + ((r * 5) % 4) * 0.004).toFixed(2)),
    cells,
  };
});

export default function PromptVersionGrainDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / prompt-version-grain
      </p>

      <div
        data-grain-card=""
        className="rounded-[12px] border border-border bg-background px-7 pb-7 pt-6"
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
          ariaLabel="Prompt block stability across twelve releases"
        />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        One fiber per prompt block, running down through every release. Unbroken
        means untouched; a nick marks the release where that block changed.
      </p>
    </div>
  );
}
