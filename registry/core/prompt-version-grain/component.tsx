"use client";

// ---------------------------------------------------------------------------
// PromptVersionGrain — which prompt blocks changed in which release.
//
// A table: columns are prompt blocks, rows are versions (newest first). A cell
// is filled when that block changed in that release and blank when it did not.
// No hover, no animation, no decoding.
// ---------------------------------------------------------------------------

export interface PromptGrainBlock {
  /** Stable key used to look the block up in each version's `changed` map. */
  id: string;
  /** Column header, e.g. "rules". */
  label: string;
}

export interface PromptGrainVersion {
  id: string;
  /** Short version label, e.g. "v37". */
  label: string;
  /** Total prompt tokens for this version. */
  tokens: number;
  /** blockId -> did this block change in this release. */
  changed: Record<string, boolean>;
}

export interface PromptVersionGrainProps {
  /** Prompt blocks, left to right. */
  blocks?: PromptGrainBlock[];
  /** Versions, NEWEST FIRST. */
  versions?: PromptGrainVersion[];
  ariaLabel?: string;
  className?: string;
}

const DEFAULT_BLOCKS: PromptGrainBlock[] = [
  { id: "system", label: "system" },
  { id: "persona", label: "persona" },
  { id: "tools", label: "tools" },
  { id: "rules", label: "rules" },
  { id: "examples", label: "examples" },
  { id: "format", label: "format" },
];

function Swatch() {
  return (
    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 bg-foreground" />
  );
}

export function PromptVersionGrain({
  blocks = DEFAULT_BLOCKS,
  versions = [],
  ariaLabel = "Prompt blocks changed per release",
  className = "",
}: PromptVersionGrainProps) {
  const head =
    "font-mono text-[10px] font-normal leading-none tracking-tight text-muted";

  return (
    <div className={className}>
      <table className="w-full border-collapse">
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${head} pb-3 pr-4 text-left`}>
              version
            </th>
            {blocks.map((b) => (
              <th key={b.id} scope="col" className={`${head} px-3 pb-3 text-center`}>
                {b.label}
              </th>
            ))}
            <th scope="col" className={`${head} pb-3 pl-4 text-right`}>
              tokens
            </th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <th
                scope="row"
                className="border-t border-border py-2 pr-4 text-left font-mono text-[11px] font-normal tabular-nums text-foreground"
              >
                {v.label}
              </th>
              {blocks.map((b) => (
                <td key={b.id} className="border-t border-border px-3 py-2 text-center">
                  {v.changed[b.id] ? <Swatch /> : null}
                  <span className="sr-only">
                    {v.changed[b.id] ? "changed" : "unchanged"}
                  </span>
                </td>
              ))}
              <td className="border-t border-border py-2 pl-4 text-right font-mono text-[11px] tabular-nums text-muted">
                {v.tokens}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted">
        <Swatch />
        changed in this release
      </p>
    </div>
  );
}

export default PromptVersionGrain;
