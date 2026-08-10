"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LightTable — a binary inspector rendered as two registered filmstrips (hex
// + ASCII) on a light table, with an offset gutter to their left. The
// mechanic is cross-pane registration, not either dump on its own: hovering
// or focusing any byte cell sets one shared index, the matching cell in the
// other pane picks up a color-mix(--foreground) tint, and a hairline rule
// is drawn across the seam between the two panes at that row so the two
// representations visibly resolve to the same byte. Non-printable bytes get
// a value-class ramp (null/control/high-bit) instead of a uniform dot, so
// the byte structure already reads before anything is touched. Shift-drag
// or Shift+Arrow extends a contiguous byte range in both panes at once; a
// live footer decodes it as length + uint16/uint32 (little-endian) + a
// UTF-8 guess. Pure DOM/CSS, no canvas — every color comes from
// --background/--foreground/--ns-muted/--border/--ns-accent.
// ---------------------------------------------------------------------------

type ByteClass = "null" | "control" | "highbit" | "printable";

const CONTROL_NAMES = [
  "NUL", "SOH", "STX", "ETX", "EOT", "ENQ", "ACK", "BEL",
  "BS", "HT", "LF", "VT", "FF", "CR", "SO", "SI",
  "DLE", "DC1", "DC2", "DC3", "DC4", "NAK", "SYN", "ETB",
  "CAN", "EM", "SUB", "ESC", "FS", "GS", "RS", "US",
];

// A plausible-looking PNG-header fragment: high-bit signature byte, ASCII
// tag letters, control bytes (CR/LF/SUB/NUL) and a trailing text chunk, so
// every value class is represented at rest without any interaction.
const SAMPLE_BYTES: number[] = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0xc8, 0x08, 0x06, 0x00, 0x00, 0x00, 0x8f, 0x5b, 0x2c,
  0x0e, 0x00, 0x00, 0x00, 0x17, 0x74, 0x45, 0x58, 0x74, 0x43, 0x6f, 0x6d, 0x6d, 0x65, 0x6e, 0x74,
  0x00, 0x6e, 0x73, 0x2d, 0x75, 0x69, 0x20, 0x6c, 0x69, 0x67, 0x68, 0x74, 0x2d, 0x74, 0x61, 0x62,
];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function toHex2(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, "0");
}

function classify(b: number): ByteClass {
  if (b === 0) return "null";
  if (b === 0x7f || b < 0x20) return "control";
  if (b > 0x7f) return "highbit";
  return "printable";
}

function asciiGlyph(b: number, cls: ByteClass): string {
  if (cls === "printable") return String.fromCharCode(b);
  if (cls === "null") return "·"; // ·
  if (cls === "control") return "▖"; // ▖
  return "▓"; // ▓ (high-bit)
}

function valueTextClass(cls: ByteClass): string {
  if (cls === "printable") return "text-foreground";
  if (cls === "highbit") return "text-foreground/60";
  return "text-ns-muted";
}

function byteDescriptor(b: number): string {
  if (b === 0x7f) return "DEL";
  if (b < 0x20) return CONTROL_NAMES[b] ?? "CTL";
  if (b > 0x7f) return "non-ASCII";
  return `'${String.fromCharCode(b)}'`;
}

function offsetLabel(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(4, "0")}`;
}

function decodeSelection(bs: number[]): { u16?: string; u32?: string; utf8: string } {
  const u16 =
    bs.length >= 2
      ? `0x${((((bs[1] ?? 0) << 8) | (bs[0] ?? 0)) & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`
      : undefined;
  const u32 =
    bs.length >= 4
      ? `0x${((((bs[3] ?? 0) << 24) | ((bs[2] ?? 0) << 16) | ((bs[1] ?? 0) << 8) | (bs[0] ?? 0)) >>> 0)
          .toString(16)
          .toUpperCase()
          .padStart(8, "0")}`
      : undefined;
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bs));
  return { u16, u32, utf8 };
}

export interface LightTableProps {
  /** The bytes to inspect. */
  bytes?: number[] | Uint8Array;
  /** Bytes rendered per row (also the row-jump distance for Arrow Up/Down). @default 16 */
  bytesPerRow?: number;
  /** Label shown in the header bar. */
  title?: string;
  className?: string;
}

export function LightTable({
  bytes = SAMPLE_BYTES,
  bytesPerRow = 16,
  title = "light-table",
  className = "",
}: LightTableProps) {
  const byteList = useMemo(() => Array.from(bytes), [bytes]);
  const total = byteList.length;
  const rows = Math.ceil(total / bytesPerRow);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [gridFocused, setGridFocused] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusedIndex((i) => clamp(i, 0, Math.max(0, total - 1)));
  }, [total]);

  useEffect(() => {
    const end = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, []);

  const liveIndex = hoverIndex ?? (gridFocused ? focusedIndex : null);
  const liveRow = liveIndex !== null ? Math.floor(liveIndex / bytesPerRow) : null;

  const selRange: [number, number] | null =
    selectionAnchor !== null ? [Math.min(selectionAnchor, focusedIndex), Math.max(selectionAnchor, focusedIndex)] : null;

  const focusCell = (idx: number) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${idx}"]`)?.focus();
  };

  const moveFocus = (delta: number, extend: boolean) => {
    if (total === 0) return;
    const next = clamp(focusedIndex + delta, 0, total - 1);
    if (extend) {
      if (selectionAnchor === null) setSelectionAnchor(focusedIndex);
    } else {
      setSelectionAnchor(null);
    }
    setFocusedIndex(next);
    focusCell(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -bytesPerRow,
      ArrowDown: bytesPerRow,
    };
    const delta = map[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    moveFocus(delta, e.shiftKey);
  };

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    if (e.shiftKey) {
      if (selectionAnchor === null) setSelectionAnchor(focusedIndex);
      draggingRef.current = true;
    } else {
      setSelectionAnchor(null);
    }
    setFocusedIndex(idx);
  };

  const handlePointerEnter = (idx: number) => {
    setHoverIndex(idx);
    if (draggingRef.current) setFocusedIndex(idx);
  };

  const handlePointerLeave = (idx: number) => {
    if (!draggingRef.current) setHoverIndex((h) => (h === idx ? null : h));
  };

  const tintStyle = (idx: number): React.CSSProperties | undefined => {
    if (selRange && idx >= selRange[0] && idx <= selRange[1]) {
      return { backgroundColor: "color-mix(in srgb, var(--foreground) 14%, transparent)" };
    }
    if (idx === liveIndex) {
      return { backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)" };
    }
    return undefined;
  };

  const cellLabel = (idx: number, b: number) =>
    `offset 0x${idx.toString(16).toUpperCase()}, value 0x${toHex2(b)}, ${byteDescriptor(b)}`;

  const footerText = useMemo(() => {
    if (selRange) {
      const [s, e] = selRange;
      const len = e - s + 1;
      const slice = byteList.slice(s, e + 1);
      const { u16, u32, utf8 } = decodeSelection(slice);
      const utf8Escaped = JSON.stringify(utf8).slice(1, -1);
      const range = len === 1 ? `0x${s.toString(16).toUpperCase()}` : `0x${s.toString(16).toUpperCase()}–0x${e.toString(16).toUpperCase()}`;
      return `selected ${len} byte${len === 1 ? "" : "s"} at ${range}${u16 ? ` · u16=${u16}` : ""}${
        u32 ? ` · u32=${u32}` : ""
      } · utf8="${utf8Escaped}"`;
    }
    if (liveIndex !== null) {
      const b = byteList[liveIndex] ?? 0;
      return `byte ${liveIndex} at 0x${liveIndex.toString(16).toUpperCase()}: 0x${toHex2(b)} ${byteDescriptor(b)}`;
    }
    return "Hover or focus a byte — Shift+drag or Shift+Arrow selects a range.";
  }, [selRange, liveIndex, byteList]);

  const rangeAnnouncement = selRange
    ? `selected ${selRange[1] - selRange[0] + 1} byte${selRange[1] - selRange[0] + 1 === 1 ? "" : "s"} at 0x${selRange[0]
        .toString(16)
        .toUpperCase()}`
    : "";

  return (
    <div
      className={`inline-flex max-w-full flex-col overflow-hidden rounded-md border border-border bg-background font-mono text-foreground ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-widest text-ns-muted">{title}</span>
        <span className="text-[11px] tabular-nums text-ns-muted">{total} bytes</span>
      </div>

      <div className="flex overflow-x-auto">
        {/* offset gutter */}
        <div className="flex shrink-0 flex-col border-r border-border">
          <div className="flex h-6 items-center px-2 text-[10px] uppercase tracking-widest text-ns-muted">offset</div>
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className={`flex h-6 items-center px-2 text-[11px] tabular-nums transition-colors duration-100 motion-reduce:transition-none ${
                liveRow === r ? "text-foreground" : "text-ns-muted"
              }`}
            >
              {offsetLabel(r * bytesPerRow)}
            </div>
          ))}
        </div>

        {/* hex pane */}
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${title} hex bytes`}
          className="flex shrink-0 flex-col"
          onFocus={() => setGridFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setGridFocused(false);
          }}
        >
          <div className="flex h-6 items-center gap-0.5 px-1">
            {Array.from({ length: bytesPerRow }, (_, c) => (
              <span key={c} className="w-6 text-center text-[10px] text-ns-muted">
                {toHex2(c)}
              </span>
            ))}
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className="flex h-6 items-center gap-0.5 px-1 transition-colors duration-100 hover:bg-foreground/[0.03] motion-reduce:transition-none"
            >
              {Array.from({ length: bytesPerRow }, (_, c) => {
                const idx = r * bytesPerRow + c;
                if (idx >= total) return <span key={c} aria-hidden className="h-6 w-6" />;
                const b = byteList[idx] ?? 0;
                const cls = classify(b);
                return (
                  <button
                    key={c}
                    type="button"
                    role="gridcell"
                    data-idx={idx}
                    data-value-class={cls}
                    tabIndex={idx === focusedIndex ? 0 : -1}
                    aria-label={cellLabel(idx, b)}
                    style={tintStyle(idx)}
                    className={`flex h-6 w-6 items-center justify-center text-[12px] outline-none transition-colors duration-100 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ns-accent ${valueTextClass(
                      cls
                    )}`}
                    onPointerDown={(e) => handlePointerDown(idx, e)}
                    onPointerEnter={() => handlePointerEnter(idx)}
                    onPointerLeave={() => handlePointerLeave(idx)}
                    onFocus={() => setFocusedIndex(idx)}
                    onKeyDown={onKeyDown}
                  >
                    {toHex2(b)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* inter-pane seam: the bridge rule lives here */}
        <div className="relative flex w-3 shrink-0 flex-col border-x border-border">
          <div className="h-6" />
          <div className="relative flex-1">
            {liveRow !== null && (
              <span
                aria-hidden
                data-bridge-rule="true"
                className="absolute -left-1 -right-1 h-px bg-foreground/80 transition-opacity duration-150 motion-reduce:transition-none"
                style={{ top: `calc(${liveRow} * 1.5rem + 0.75rem)` }}
              />
            )}
          </div>
        </div>

        {/* ascii pane — mirrors the hex grid's information, so it's hidden from AT */}
        <div aria-hidden="true" className="flex shrink-0 flex-col">
          <div className="flex h-6 items-center justify-center px-1 text-[10px] uppercase tracking-widest text-ns-muted">
            ascii
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className="flex h-6 items-center px-1 transition-colors duration-100 hover:bg-foreground/[0.03] motion-reduce:transition-none"
            >
              {Array.from({ length: bytesPerRow }, (_, c) => {
                const idx = r * bytesPerRow + c;
                if (idx >= total) return <span key={c} className="h-6 w-3.5" />;
                const b = byteList[idx] ?? 0;
                const cls = classify(b);
                return (
                  <span
                    key={c}
                    data-ascii-idx={idx}
                    data-value-class={cls}
                    data-linked={idx === liveIndex ? "true" : undefined}
                    style={tintStyle(idx)}
                    className={`flex h-6 w-3.5 items-center justify-center text-[12px] transition-colors duration-100 motion-reduce:transition-none ${valueTextClass(
                      cls
                    )}`}
                    onPointerEnter={() => handlePointerEnter(idx)}
                    onPointerLeave={() => handlePointerLeave(idx)}
                  >
                    {asciiGlyph(b, cls)}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-3 py-1.5 text-[11px] tabular-nums text-ns-muted">{footerText}</div>
      <span aria-live="polite" className="sr-only">
        {rangeAnnouncement}
      </span>
    </div>
  );
}
