"use client";

import { useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// GridBentoAscii — a 2x2 bento layout primitive where the seams between
// cells are real box-drawing structure, not a picture of one: the grid is
// built on its own track grid (content / seam / content, on both axes), so
// there is exactly one vertical rule, one horizontal rule and one ┼
// junction glyph, all as real elements at real grid positions. Activating a
// cell doesn't recolor anything — it re-spans that cell across every track,
// content and seam alike, so the seam literally has nowhere left to be
// drawn and disappears as a structural consequence, not an animation
// playing on its own clock. Collapsing brings the topology, and the seam,
// back. This mechanic does not exist on a single box: it needs the seam's
// topology to have something to gain or lose.
// ---------------------------------------------------------------------------

export interface BentoCell {
  id: string;
  title: string;
  description?: string;
  content?: ReactNode;
}

export interface GridBentoAsciiProps {
  /** the grid's four tiles */
  cells: [BentoCell, BentoCell, BentoCell, BentoCell];
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function GridBentoAscii({ cells, className = "" }: GridBentoAsciiProps) {
  const [heroId, setHeroId] = useState<string | null>(null);

  const positions: Record<number, { col: string; row: string }> = {
    0: { col: "1 / 2", row: "1 / 2" },
    1: { col: "3 / 4", row: "1 / 2" },
    2: { col: "1 / 2", row: "3 / 4" },
    3: { col: "3 / 4", row: "3 / 4" },
  };

  const heroIndex = heroId ? cells.findIndex((c) => c.id === heroId) : -1;
  const expanded = heroIndex !== -1;

  return (
    <div
      data-grid-bento-ascii
      className={`relative grid aspect-square w-full max-w-md gap-0 font-mono ${className}`}
      style={{
        gridTemplateColumns: "1fr 1.4em 1fr",
        gridTemplateRows: "1fr 1.4em 1fr",
      }}
    >
      {/* seams: real elements at real grid tracks, only rendered while every
          cell is at its own resting position */}
      {!expanded && (
        <>
          <div
            aria-hidden
            className="pointer-events-none bg-border transition-opacity duration-150 motion-reduce:transition-none"
            style={{ gridColumn: "2 / 3", gridRow: "1 / 4", width: 1, justifySelf: "center" }}
          />
          <div
            aria-hidden
            className="pointer-events-none bg-border transition-opacity duration-150 motion-reduce:transition-none"
            style={{ gridColumn: "1 / 4", gridRow: "2 / 3", height: 1, alignSelf: "center" }}
          />
          <span
            aria-hidden
            className="pointer-events-none grid select-none place-items-center text-border transition-opacity duration-150 motion-reduce:transition-none"
            style={{ gridColumn: "2 / 3", gridRow: "2 / 3" }}
          >
            +
          </span>
        </>
      )}

      {cells.map((cell, i) => {
        const isHero = heroId === cell.id;
        const hiddenByHero = expanded && !isHero;
        const style = isHero && expanded ? { col: "1 / 4", row: "1 / 4" } : positions[i]!;

        return (
          <button
            key={cell.id}
            type="button"
            data-cell={cell.id}
            aria-pressed={isHero}
            aria-label={isHero ? `Collapse ${cell.title}` : `Expand ${cell.title}`}
            aria-hidden={hiddenByHero || undefined}
            tabIndex={hiddenByHero ? -1 : 0}
            onClick={() => setHeroId(isHero ? null : cell.id)}
            className={`group relative flex flex-col items-start justify-end overflow-hidden rounded-sm border border-border bg-surface p-3 text-left transition-[opacity,border-color] duration-150 motion-reduce:transition-none hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
              hiddenByHero ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
            style={{ gridColumn: style.col, gridRow: style.row }}
          >
            {isHero && expanded && (
              <span
                aria-hidden
                data-hero-badge
                className="absolute right-2 top-2 select-none rounded-sm border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-wider text-ns-muted"
              >
                click to collapse
              </span>
            )}
            {cell.content}
            <span className="text-sm font-semibold text-foreground">{cell.title}</span>
            {cell.description && (
              <span className="mt-1 text-xs text-ns-muted group-hover:text-foreground/80">
                {cell.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
