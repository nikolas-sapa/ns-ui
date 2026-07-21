"use client";

import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// SeamDiff — a line-addressable unified-diff viewer. Instead of red/green
// blocks it marks added/removed lines with a thin left-rail glyph (solid
// bar for additions, a diagonal hairline hatch for deletions, both derived
// from --foreground) plus a muted +/− gutter glyph, so the diff reads as
// typography rather than a traffic light and stays legible to colorblind
// readers. Every rendered line has a stable address ("n<newLineNo>" or
// "o<oldLineNo>" for a pure deletion) that a `widgets` map can attach
// arbitrary React to — an AI annotation, a review comment, an inline
// suggestion — rendered as a full-width row directly under that line in
// both unified and split mode. Pure DOM/CSS, no canvas, zero dependencies.
// A malformed diff never throws: unparsable hunk headers are flagged
// in place and non-diff input falls back to a plain line list with a
// visible notice, rather than crashing or silently misreading.
// ---------------------------------------------------------------------------

type LineType = "add" | "del" | "context" | "raw";

interface LineEntry {
  kind: "line";
  type: LineType;
  content: string;
  oldNo?: number;
  newNo?: number;
}

interface FileHeaderEntry {
  kind: "fileheader";
  oldPath?: string;
  newPath?: string;
}

interface HunkEntry {
  kind: "hunk";
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  malformed: boolean;
  raw: string;
}

interface MetaEntry {
  kind: "meta";
  text: string;
}

type Entry = LineEntry | FileHeaderEntry | HunkEntry | MetaEntry;

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function cleanPath(raw: string): string {
  const stripped = (raw.split("\t")[0] ?? "").trim();
  if (stripped === "/dev/null" || stripped === "") return stripped;
  return stripped.replace(/^[ab]\//, "");
}

/** Parses a unified diff string. Never throws — a line it can't place in a
 * hunk becomes a visible "raw" line, and input with no recognizable hunks
 * at all degrades to a flat raw block with `degraded: true`. */
function parseDiff(diff: string): { entries: Entry[]; degraded: boolean } {
  const lines = diff.replace(/\r\n/g, "\n").split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  const entries: Entry[] = [];
  let state: "header" | "hunk" = "header";
  let oldNo = NaN;
  let newNo = NaN;
  let sawHunk = false;

  for (const raw of lines) {
    if (raw.startsWith("diff --git") || raw.startsWith("diff ")) {
      state = "header";
      entries.push({ kind: "meta", text: raw });
      continue;
    }

    if (
      state === "header" &&
      /^(index |similarity index|rename from|rename to|new file mode|deleted file mode|old mode|new mode|Binary files)/.test(
        raw
      )
    ) {
      entries.push({ kind: "meta", text: raw });
      continue;
    }

    if (state === "header" && raw.startsWith("--- ")) {
      entries.push({ kind: "fileheader", oldPath: cleanPath(raw.slice(4)) });
      continue;
    }

    if (state === "header" && raw.startsWith("+++ ")) {
      const prev = entries[entries.length - 1];
      if (prev && prev.kind === "fileheader" && prev.newPath === undefined) {
        prev.newPath = cleanPath(raw.slice(4));
      } else {
        entries.push({ kind: "fileheader", newPath: cleanPath(raw.slice(4)) });
      }
      continue;
    }

    if (raw.startsWith("@@")) {
      sawHunk = true;
      const m = raw.match(HUNK_RE);
      if (m) {
        oldNo = parseInt(m[1] ?? "0", 10);
        newNo = parseInt(m[3] ?? "0", 10);
        entries.push({
          kind: "hunk",
          header: (m[5] ?? "").trim(),
          oldStart: oldNo,
          oldLines: m[2] !== undefined ? parseInt(m[2], 10) : 1,
          newStart: newNo,
          newLines: m[4] !== undefined ? parseInt(m[4], 10) : 1,
          malformed: false,
          raw,
        });
      } else {
        oldNo = NaN;
        newNo = NaN;
        entries.push({
          kind: "hunk",
          header: "",
          oldStart: NaN,
          oldLines: 0,
          newStart: NaN,
          newLines: 0,
          malformed: true,
          raw,
        });
      }
      state = "hunk";
      continue;
    }

    if (state === "hunk") {
      if (raw.startsWith("\\")) {
        entries.push({ kind: "meta", text: raw.replace(/^\\\s*/, "") });
        continue;
      }
      const marker = raw.charAt(0);
      const content = raw.slice(1);
      if (marker === "+") {
        entries.push({
          kind: "line",
          type: "add",
          content,
          newNo: Number.isNaN(newNo) ? undefined : newNo++,
        });
      } else if (marker === "-") {
        entries.push({
          kind: "line",
          type: "del",
          content,
          oldNo: Number.isNaN(oldNo) ? undefined : oldNo++,
        });
      } else if (marker === " " || raw === "") {
        entries.push({
          kind: "line",
          type: "context",
          content: marker === " " ? content : "",
          oldNo: Number.isNaN(oldNo) ? undefined : oldNo++,
          newNo: Number.isNaN(newNo) ? undefined : newNo++,
        });
      } else {
        entries.push({ kind: "line", type: "raw", content: raw });
      }
      continue;
    }

    if (raw.trim() !== "") entries.push({ kind: "meta", text: raw });
  }

  if (!sawHunk) {
    if (diff.trim() === "") return { entries: [], degraded: false };
    return {
      entries: lines.map((l) => ({ kind: "line", type: "raw", content: l })),
      degraded: true,
    };
  }

  return { entries, degraded: false };
}

function lineKey(entry: LineEntry): string | undefined {
  if (entry.newNo != null) return `n${entry.newNo}`;
  if (entry.oldNo != null) return `o${entry.oldNo}`;
  return undefined;
}

function widgetFor(
  entry: LineEntry | undefined,
  widgets: Record<string, React.ReactNode> | undefined
): React.ReactNode {
  if (!entry || !widgets) return undefined;
  const key = lineKey(entry);
  return key ? widgets[key] : undefined;
}

// -- split-mode row pairing: consecutive deletions and consecutive
// additions are zipped into aligned rows, the shorter side padded with an
// empty cell; context/raw lines mirror onto both sides. -------------------

type SplitPairRow = { old?: LineEntry; new?: LineEntry };

function buildSplitPairs(entries: Entry[]): (SplitPairRow | { full: FileHeaderEntry | HunkEntry | MetaEntry })[] {
  const out: (SplitPairRow | { full: FileHeaderEntry | HunkEntry | MetaEntry })[] = [];
  let delBuf: LineEntry[] = [];
  let addBuf: LineEntry[] = [];
  const flush = () => {
    const n = Math.max(delBuf.length, addBuf.length);
    for (let i = 0; i < n; i++) out.push({ old: delBuf[i], new: addBuf[i] });
    delBuf = [];
    addBuf = [];
  };
  for (const e of entries) {
    if (e.kind === "line" && e.type === "del") {
      delBuf.push(e);
      continue;
    }
    if (e.kind === "line" && e.type === "add") {
      addBuf.push(e);
      continue;
    }
    flush();
    if (e.kind === "line") {
      out.push({ old: e, new: e.type === "context" ? e : undefined });
    } else {
      out.push({ full: e });
    }
  }
  flush();
  return out;
}

const HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--foreground) 0px, var(--foreground) 1px, transparent 1px, transparent 4px)",
  opacity: 0.4,
};

function railStyle(type: LineType | undefined): { className: string; style?: React.CSSProperties } {
  if (type === "add") return { className: "bg-foreground/60" };
  if (type === "del") return { className: "", style: HATCH_STYLE };
  return { className: "" };
}

function glyphFor(type: LineType | undefined): string {
  if (type === "add") return "+";
  if (type === "del") return "−";
  if (type === "raw") return "?";
  return "";
}

function washClass(type: LineType | undefined): string {
  return type === "add" || type === "del" ? "bg-foreground/[0.025]" : "";
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 1.5h5L12.5 5v9a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
        strokeLinejoin="round"
      />
      <path d="M9 1.5V5h3.5" strokeLinejoin="round" />
    </svg>
  );
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 1.6 14.6 13a1 1 0 0 1-.87 1.5H2.27a1 1 0 0 1-.87-1.5L8 1.6Z" strokeLinejoin="round" />
      <path d="M8 6.2v3.1" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FullRow({ entry }: { entry: FileHeaderEntry | HunkEntry | MetaEntry }) {
  if (entry.kind === "fileheader") {
    const label =
      entry.oldPath && entry.newPath && entry.oldPath !== entry.newPath && entry.oldPath !== "/dev/null"
        ? `${entry.oldPath} → ${entry.newPath}`
        : entry.newPath && entry.newPath !== "/dev/null"
          ? entry.newPath
          : (entry.oldPath ?? "unknown file");
    return (
      <div className="flex items-center gap-2 border-y border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-muted">
        <FileIcon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    );
  }
  if (entry.kind === "hunk") {
    if (entry.malformed) {
      return (
        <div className="flex items-center gap-2 border-y border-dashed border-border px-3 py-1.5 text-[12px] text-muted">
          <WarnIcon className="h-3 w-3 shrink-0" />
          <span>
            Unparsable hunk header, showing following lines as-is:{" "}
            <span className="font-mono">{entry.raw}</span>
          </span>
        </div>
      );
    }
    return (
      <div className="border-y border-border bg-surface px-3 py-1 font-mono text-[12px] tabular-nums text-muted">
        {`@@ -${entry.oldStart},${entry.oldLines} +${entry.newStart},${entry.newLines} @@`}
        {entry.header ? ` ${entry.header}` : ""}
      </div>
    );
  }
  return <div className="px-3 py-1 font-mono text-[11px] italic text-muted">{entry.text}</div>;
}

// Split mode cannot scroll a long line the way unified can: Tailwind's
// `grid-cols-2` is `minmax(0,1fr)`, so a pane never grows past half the width
// and `whitespace-pre` content painted straight over the divider and on top of
// the other pane's line numbers. Wrapping inside the pane keeps every character
// readable and the divider centred — and because both halves of a row are
// `items-stretch` siblings of the same grid, alignment stays exact even when
// only one side wraps.
function Content({ text, wrap = false }: { text: string; wrap?: boolean }) {
  return <span className={`${wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"} pr-4`}>{text.length ? text : " "}</span>;
}

// -- unified mode -----------------------------------------------------------

function UnifiedLine({ entry }: { entry: LineEntry }) {
  const rail = railStyle(entry.type);
  const wash = washClass(entry.type);
  return (
    <div className="grid grid-cols-[3px_4ch_4ch_1.5ch_1fr] items-stretch leading-5">
      <span aria-hidden className={rail.className} style={rail.style} />
      <span className={`select-none py-[3px] pr-2 text-right font-mono text-[12px] tabular-nums text-muted ${wash}`}>
        {entry.oldNo ?? ""}
      </span>
      <span className={`select-none py-[3px] pr-2 text-right font-mono text-[12px] tabular-nums text-muted ${wash}`}>
        {entry.newNo ?? ""}
      </span>
      <span
        aria-hidden
        className={`select-none py-[3px] text-center font-mono text-[12px] ${wash} ${
          entry.type === "add" || entry.type === "del" ? "text-foreground" : "text-muted"
        }`}
      >
        {glyphFor(entry.type)}
      </span>
      <span className={`py-[3px] font-mono text-[13px] ${wash}`}>
        <Content text={entry.content} />
      </span>
    </div>
  );
}

function renderUnified(
  entries: Entry[],
  widgets: Record<string, React.ReactNode> | undefined
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let key = 0;
  for (const e of entries) {
    if (e.kind !== "line") {
      out.push(<FullRow key={key++} entry={e} />);
      continue;
    }
    out.push(<UnifiedLine key={key++} entry={e} />);
    const widget = widgetFor(e, widgets);
    if (widget) {
      out.push(
        <div key={key++} className="border-t border-border bg-surface py-2.5 pl-[calc(3px_+_4ch_+_4ch_+_1.5ch_+_1rem)] pr-4">
          {widget}
        </div>
      );
    }
  }
  return out;
}

// -- split mode ---------------------------------------------------------

function SplitHalf({ entry, side }: { entry: LineEntry | undefined; side: "old" | "new" }) {
  if (!entry) {
    return (
      <div className="grid grid-cols-[3px_4ch_1.5ch_1fr] items-stretch bg-foreground/[0.015] leading-5">
        <span aria-hidden />
        <span />
        <span />
        <span />
      </div>
    );
  }
  const rail = railStyle(entry.type);
  const wash = washClass(entry.type);
  const num = side === "old" ? entry.oldNo : entry.newNo;
  return (
    <div className="grid grid-cols-[3px_4ch_1.5ch_1fr] items-stretch leading-5">
      <span aria-hidden className={rail.className} style={rail.style} />
      <span className={`select-none py-[3px] pr-2 text-right font-mono text-[12px] tabular-nums text-muted ${wash}`}>
        {num ?? ""}
      </span>
      <span
        aria-hidden
        className={`select-none py-[3px] text-center font-mono text-[12px] ${wash} ${
          entry.type === "add" || entry.type === "del" ? "text-foreground" : "text-muted"
        }`}
      >
        {glyphFor(entry.type)}
      </span>
      {/* the right padding lives on the CELL, not on the inline <span>: inline
          padding only applies to the last line fragment, so a wrapped line ran
          flush into the pane's edge. */}
      <span className={`py-[3px] pr-3 font-mono text-[13px] ${wash}`}>
        <Content text={entry.content} wrap />
      </span>
    </div>
  );
}

function renderSplit(
  entries: Entry[],
  widgets: Record<string, React.ReactNode> | undefined
): React.ReactNode[] {
  const items = buildSplitPairs(entries);
  const out: React.ReactNode[] = [];
  let key = 0;
  for (const item of items) {
    if ("full" in item) {
      out.push(<FullRow key={key++} entry={item.full} />);
      continue;
    }
    const oldWidget = widgetFor(item.old, widgets);
    const newWidget = item.new !== item.old ? widgetFor(item.new, widgets) : undefined;
    out.push(
      <div key={key++} className="grid grid-cols-2">
        <SplitHalf entry={item.old} side="old" />
        <div className="border-l border-border">
          <SplitHalf entry={item.new} side="new" />
        </div>
      </div>
    );
    if (oldWidget || newWidget) {
      out.push(
        <div key={key++} className="grid grid-cols-2 border-t border-border bg-surface">
          <div className="py-2.5 pl-[calc(3px_+_4ch_+_1.5ch_+_1rem)] pr-4">{oldWidget}</div>
          <div className="border-l border-border py-2.5 pl-[calc(3px_+_4ch_+_1.5ch_+_1rem)] pr-4">{newWidget}</div>
        </div>
      );
    }
  }
  return out;
}

// -- mode toggle -------------------------------------------------------------

const MODES = [
  { value: "unified", label: "Unified" },
  { value: "split", label: "Split" },
] as const;

type Mode = (typeof MODES)[number]["value"];

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = MODES.findIndex((o) => o.value === mode);
    let next = -1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + MODES.length) % MODES.length;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % MODES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = MODES.length - 1;
    else return;
    e.preventDefault();
    const target = MODES[next];
    if (target) onChange(target.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Diff view"
      onKeyDown={onKeyDown}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-sm border border-border bg-foreground/[0.04] p-0.5"
    >
      {MODES.map((opt) => {
        const selected = opt.value === mode;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={`rounded-[4px] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
              // The *selected* segment needs a hover affordance too, not just the
              // unselected one: hovering the currently-active view was previously
              // a dead pixel-for-pixel no-op, which reads as an inert label
              // rather than a control you can point at. `ring`, not `outline` —
              // the base class sets `outline-none`, which pins `--tw-outline-style`
              // to none and silently swallows any hover outline width. Tailwind
              // orders `focus-visible:` after `hover:`, so the accent focus ring
              // still wins over this when both apply.
              selected
                ? "bg-background text-foreground shadow-sm hover:ring-1 hover:ring-inset hover:ring-border"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// -- public component ---------------------------------------------------

export interface SeamDiffProps {
  /** A unified-diff string (as produced by `git diff`, `diff -u`, etc). */
  diff: string;
  /** Controlled view mode. Omit to let the component manage its own. */
  mode?: Mode;
  /** Initial view mode when uncontrolled. @default "unified" */
  defaultMode?: Mode;
  /** Fires whenever the view mode changes, from a click or the keyboard. */
  onModeChange?: (mode: Mode) => void;
  /**
   * Arbitrary React keyed by line address, rendered as a full-width row
   * directly under that line. A line's address is `n<newLineNo>` for any
   * line that exists in the new file (context or addition), or
   * `o<oldLineNo>` for a line that only exists in the old file (a pure
   * deletion) — e.g. `{ "n42": <AiSuggestion />, "o17": <ReviewNote /> }`.
   */
  widgets?: Record<string, React.ReactNode>;
  /** Accessible name for the scrollable diff region. */
  ariaLabel?: string;
  className?: string;
}

export function SeamDiff({
  diff,
  mode,
  defaultMode = "unified",
  onModeChange,
  widgets,
  ariaLabel,
  className = "",
}: SeamDiffProps) {
  const isControlled = mode !== undefined;
  const [internalMode, setInternalMode] = useState<Mode>(defaultMode);
  const activeMode = isControlled ? mode : internalMode;

  const setMode = (m: Mode) => {
    if (!isControlled) setInternalMode(m);
    if (m !== activeMode) onModeChange?.(m);
  };

  const parsed = useMemo(() => parseDiff(diff ?? ""), [diff]);

  const { filePath, renamedFrom, added, removed } = useMemo(() => {
    let fh: FileHeaderEntry | undefined;
    let a = 0;
    let r = 0;
    for (const e of parsed.entries) {
      if (e.kind === "fileheader" && !fh) fh = e;
      else if (e.kind === "line") {
        if (e.type === "add") a++;
        else if (e.type === "del") r++;
      }
    }
    const newPath = fh?.newPath && fh.newPath !== "/dev/null" ? fh.newPath : undefined;
    const oldPath = fh?.oldPath && fh.oldPath !== "/dev/null" ? fh.oldPath : undefined;
    const renamed = !!(newPath && oldPath && newPath !== oldPath);
    return {
      filePath: newPath ?? oldPath,
      renamedFrom: renamed ? oldPath : undefined,
      added: a,
      removed: r,
    };
  }, [parsed]);

  const rows = useMemo(() => {
    if (parsed.degraded) return null;
    return activeMode === "split" ? renderSplit(parsed.entries, widgets) : renderUnified(parsed.entries, widgets);
  }, [parsed, activeMode, widgets]);

  const regionLabel = ariaLabel ?? (filePath ? `Diff for ${filePath}` : "Diff");

  return (
    <div className={`flex flex-col overflow-hidden rounded-md border border-border bg-background text-foreground ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[13px]">
          <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate">
            {renamedFrom ? (
              <>
                <span className="text-muted">{renamedFrom}</span>
                <span className="mx-1 text-muted">{"→"}</span>
                <span>{filePath}</span>
              </>
            ) : (
              <span>{filePath ?? "diff"}</span>
            )}
          </span>
          {(added > 0 || removed > 0) && (
            <span className="ml-1 shrink-0 font-mono text-[12px] tabular-nums text-muted">
              +{added} {"−"}
              {removed}
            </span>
          )}
        </div>
        <ModeToggle mode={activeMode} onChange={setMode} />
        <span aria-live="polite" className="sr-only">
          {activeMode === "split" ? "Split view" : "Unified view"}
        </span>
      </div>

      {parsed.degraded ? (
        <div>
          <div className="flex items-center gap-2 border-b border-dashed border-border px-3 py-1.5 text-[12px] text-muted">
            <WarnIcon className="h-3 w-3 shrink-0" />
            <span>This doesn&apos;t look like a unified diff, showing the raw text below.</span>
          </div>
          <div role="region" aria-label={regionLabel} className="overflow-x-auto">
            {parsed.entries.map((e, i) =>
              e.kind === "line" ? (
                <div key={i} className="whitespace-pre px-3 py-[3px] font-mono text-[13px] leading-5">
                  {e.content.length ? e.content : " "}
                </div>
              ) : null
            )}
          </div>
        </div>
      ) : parsed.entries.length === 0 ? (
        <div className="px-3 py-6 text-center font-mono text-[13px] text-muted">Nothing to show.</div>
      ) : (
        <div role="region" aria-label={regionLabel} className="overflow-x-auto">
          {rows}
        </div>
      )}
    </div>
  );
}
