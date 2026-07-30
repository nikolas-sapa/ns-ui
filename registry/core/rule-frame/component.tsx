"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Role = "corner-tl" | "corner-tr" | "corner-bl" | "corner-br" | "h" | "v";
type Cell = { char: string } | { refIndex: number; role: Role };

const SINGLE: Record<Role, string> = {
  "corner-tl": "┌",
  "corner-tr": "┐",
  "corner-bl": "└",
  "corner-br": "┘",
  h: "─",
  v: "│",
};
const DOUBLE: Record<Role, string> = {
  "corner-tl": "╔",
  "corner-tr": "╗",
  "corner-bl": "╚",
  "corner-br": "╝",
  h: "═",
  v: "║",
};

const LINE_HEIGHT = 1.4;

export interface RuleFrameProps {
  /** sits inline in the top rule, like a fieldset legend */
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

// Builds every border position once, as plain data, in true clockwise order
// starting at the top-left corner: each rule-character position gets a
// stable `refIndex` (0..N-1) assigned by pure traversal order, never by a
// ref-callback side effect. That matters because React tears down and sets
// up a ref callback on every render whose identity changed (ours always
// does, since it closes over per-render data) — if the index came from an
// incrementing counter read inside the callback itself, an old callback's
// teardown firing after a new callback's setup would scramble the count.
// Indexing from precomputed data sidesteps that: every callback, old or
// new, only ever writes to the one slot it was built for.
function buildPerimeter(cols: number, rows: number, title?: string) {
  const role: Role[] = [];
  let n = 0;
  const alloc = (r: Role) => {
    role[n] = r;
    return n++;
  };

  const titleText = title ? ` ${title} ` : "";
  const titleCols = Math.min(titleText.length, Math.max(0, cols - 2));
  const leftDashes = Math.max(1, Math.floor((cols - titleCols) / 2));

  const tl: Cell = { refIndex: alloc("corner-tl"), role: "corner-tl" };
  const top: Cell[] = [];
  for (let i = 0; i < cols; i++) {
    if (title && i >= leftDashes && i < leftDashes + titleCols) {
      top.push({ char: titleText[i - leftDashes] });
    } else {
      top.push({ refIndex: alloc("h"), role: "h" });
    }
  }
  const tr: Cell = { refIndex: alloc("corner-tr"), role: "corner-tr" };

  const right: Cell[] = Array.from({ length: rows }, () => ({
    refIndex: alloc("v"),
    role: "v" as Role,
  }));

  const br: Cell = { refIndex: alloc("corner-br"), role: "corner-br" };
  // clockwise continues right-to-left along the bottom
  const bottomRTL: Cell[] = Array.from({ length: cols }, () => ({
    refIndex: alloc("h"),
    role: "h" as Role,
  }));
  const bl: Cell = { refIndex: alloc("corner-bl"), role: "corner-bl" };

  // then bottom-to-top along the left edge
  const leftBTT: Cell[] = Array.from({ length: rows }, () => ({
    refIndex: alloc("v"),
    role: "v" as Role,
  }));

  return { role, tl, top, tr, right, br, bottomRTL, bl, leftBTT, total: n };
}

export function RuleFrame({ title, children, className = "" }: RuleFrameProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [grid, setGrid] = useState({ cols: 20, rows: 4 });
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const active = hovered || focusWithin;

  // measure the content box + a 1ch/1lh probe, recompute the character
  // counts the border needs to tile exactly across whatever size the
  // children end up being
  useLayoutEffect(() => {
    const content = contentRef.current;
    const probe = probeRef.current;
    if (!content || !probe) return;

    const measure = () => {
      const cell = probe.getBoundingClientRect();
      const box = content.getBoundingClientRect();
      if (cell.width <= 0 || cell.height <= 0) return;
      setGrid({
        cols: Math.max(4, Math.round(box.width / cell.width)),
        rows: Math.max(2, Math.round(box.height / cell.height)),
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    document.fonts.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [title]);

  const perimeter = useMemo(
    () => buildPerimeter(grid.cols, grid.rows, title),
    [grid.cols, grid.rows, title]
  );

  const elsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const roleRef = useRef<Role[]>([]);
  roleRef.current = perimeter.role;

  const cellRef = (cell: Cell) => {
    if ("char" in cell) return undefined;
    const { refIndex } = cell;
    return (el: HTMLSpanElement | null) => {
      elsRef.current[refIndex] = el;
    };
  };

  const renderCell = (cell: Cell, key: number) =>
    "char" in cell ? (
      <span key={key} aria-hidden className="text-foreground">
        {cell.char}
      </span>
    ) : (
      <span key={key} aria-hidden ref={cellRef(cell)} />
    );

  // paint every position's resting glyph before the sweep effect below gets
  // a chance to animate it, so a grid change mid-hover never flashes blank
  useLayoutEffect(() => {
    roleRef.current.forEach((role, i) => {
      const el = elsRef.current[i];
      if (el) el.textContent = active ? DOUBLE[role] : SINGLE[role];
    });
  });

  // the actual sweep: character-by-character, starting at the top-left
  // corner (refIndex 0) and proceeding clockwise in refIndex order
  useEffect(() => {
    const n = perimeter.total;
    if (n === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (count: number) => {
      for (let i = 0; i < n; i++) {
        const el = elsRef.current[i];
        if (!el) continue;
        const role = roleRef.current[i];
        const flipped = active ? i < count : i >= count;
        el.textContent = flipped ? DOUBLE[role] : SINGLE[role];
      }
    };

    if (reduced) {
      // paint(n) settles BOTH directions: active flips `i < n` (all double),
      // inactive flips `i >= n` (all single). `paint(0)` for inactive would
      // flip every index and render a full double border at rest.
      paint(n);
      return;
    }

    const duration = Math.min(900, Math.max(300, n * 16));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const frac = Math.min(1, (now - start) / duration);
      paint(Math.floor(frac * n));
      if (frac < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, perimeter]);

  return (
    <div
      data-rule-frame
      className={`relative inline-block font-mono ${className}`}
      style={{ lineHeight: LINE_HEIGHT }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false);
      }}
    >
      {/* 1ch/1lh probe — invisible, used only to measure the font's own
          character cell so the border can tile in whole characters */}
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none invisible absolute"
        style={{ width: "1ch", height: "1lh", lineHeight: LINE_HEIGHT }}
      />

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 select-none transition-colors duration-300 ${
          active ? "text-foreground" : "text-border"
        }`}
      >
        <div className="absolute inset-x-0 top-0 flex whitespace-pre">
          {renderCell(perimeter.tl, -1)}
          {perimeter.top.map(renderCell)}
          {renderCell(perimeter.tr, -2)}
        </div>
        <div
          className="absolute right-0 flex flex-col"
          style={{ top: "1lh", bottom: "1lh" }}
        >
          {perimeter.right.map(renderCell)}
        </div>
        {/* rendered right-to-left in the DOM (matching the clockwise refIndex
            order) and restored to visual left-to-right with row-reverse */}
        <div className="absolute inset-x-0 bottom-0 flex flex-row-reverse whitespace-pre">
          {renderCell(perimeter.br, -3)}
          {perimeter.bottomRTL.map(renderCell)}
          {renderCell(perimeter.bl, -4)}
        </div>
        {/* rendered bottom-to-top in the DOM, restored to visual top-to-bottom
            with column-reverse */}
        <div
          className="absolute left-0 flex flex-col-reverse"
          style={{ top: "1lh", bottom: "1lh" }}
        >
          {perimeter.leftBTT.map(renderCell)}
        </div>
      </div>

      <div ref={contentRef} className="relative" style={{ padding: "1lh 1ch" }}>
        {children}
      </div>
    </div>
  );
}
