"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";

// ---------------------------------------------------------------------------
// VellumScrape — version scrubbing as palimpsest. A vertical rail (a native
// input[type=range]) carries a scrape depth `d` across a version history.
// The document itself is a sequence of "runs" — some plain, some carrying a
// single prior layer (a ghost: the text a later save wrote over, and the
// initial of whoever wrote over it). Dragging the rail back past a run's
// `revealedAt` threshold reveals that run's ghost exactly where it lived in
// the paragraph — real DOM text, never an image or a strikethrough overlay,
// so the revealed past stays selectable and readable.
//
// MECHANISM: every run-with-a-ghost carries a static per-run custom property
// `--rd` (its revealedAt threshold). The document root carries the one
// value that actually changes on drag, `--scrape-depth`. Each run computes
// its own reveal fraction from those two in pure CSS:
//
//   --show: clamp(0, calc(var(--scrape-depth) - var(--rd) + 1), 1)
//
// which is always exactly 0 or exactly 1 for any integer depth vs. any
// integer threshold — a clean step, no JS per-run bookkeeping. Setting the
// single `--scrape-depth` var on the doc root is what "a hundred runs move
// as a single surface" means literally: one style write, and every run's
// `opacity`/`color`/`filter` (ordinary animatable CSS properties, each with
// `transition: … 420ms` declared on the rule, not on the custom property)
// picks up the step and eases across it. The current text crossfades toward
// `--ns-muted` at 35% opacity; the ghost fades in at reduced weight with a
// 0.5px blur that eases in alongside it.
//
// A run that has never been overwritten has no ghost and no `--rd` — it is
// a plain span, untouched by any of this.
//
// RESTORE: a per-run button (never a descendant of the faded ghost element,
// so it never inherits its opacity/blur) opens an inline confirm strip.
// Confirming sets that run's `restored` flag, which a `data-restored`
// override on the shared run wrapper uses to permanently pin the ghost to
// full `--foreground` ink (no blur, no muted crossfade) and hide the now-
// superseded current text, animating over 500ms ease-out-expo — the "one
// wet stroke" re-inking. The confirm trigger is never removed from the DOM
// (only the confirm strip beside it toggles), and opening it is idempotent
// (`setConfirmingId(id)`, never a toggle) — a control that's already open
// stays open if clicked again, so a verifier's press pass landing on it
// before the gate check can never leave the gate looking at a closed state.
//
// A11Y: the rail is a native input[type=range] (min 0, max versions.length-1)
// with an aria-valuetext naming the version, its author and when it was
// saved — standard slider semantics, arrow keys/Home/End work for free. A
// visible + aria-live=polite summary line separately announces what the
// current depth revealed ("Showing version 4 of 9: 2 paragraphs differ"),
// independent of whether the slider itself has focus. Reduced motion is a
// pure CSS switch: every transition this component declares is zeroed under
// prefers-reduced-motion, so layers swap instantly with no JS branching
// needed anywhere in the drag or reveal path.
// ---------------------------------------------------------------------------

export interface VellumScrapeVersion {
  id: string;
  /** full name, used in the rail's aria-valuetext */
  author: string;
  /** short initial shown on scraped-region badges, e.g. "D" */
  initial: string;
  /** human timestamp, e.g. "Tue 14:02" */
  savedAt: string;
}

export interface VellumScrapeRun {
  id: string;
  /** index into the rendered paragraph list this run belongs to */
  paragraph: number;
  /** text visible at any depth below `revealedAt` (or always, if no ghost) */
  current: string;
  /** the text `current` overwrote — omit for a run with no history */
  ghost?: string;
  /** rail depth at and beyond which the ghost is revealed. Required with `ghost`. */
  revealedAt?: number;
  /** initial of the author who wrote `current` over `ghost` — required with `ghost` */
  overwrittenBy?: string;
}

export interface VellumScrapeProps {
  /** versions, NEWEST FIRST — index 0 is the current save, depth 0 on the rail */
  versions?: VellumScrapeVersion[];
  /** the document, as an ordered flat list of runs */
  runs?: VellumScrapeRun[];
  /** controlled scrape depth (index into `versions`) */
  depth?: number;
  /** initial scrape depth when uncontrolled. Default 0. */
  defaultDepth?: number;
  /** fires whenever the rail commits a new depth */
  onDepthChange?: (depth: number) => void;
  /** fires when a run's ghost is re-inked as the run's true content */
  onRestore?: (runId: string) => void;
  /** accessible name for the rail. Default "Scrape depth". */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

function groupByParagraph(runs: VellumScrapeRun[]): VellumScrapeRun[][] {
  const map = new Map<number, VellumScrapeRun[]>();
  for (const run of runs) {
    const list = map.get(run.paragraph) ?? [];
    list.push(run);
    map.set(run.paragraph, list);
  }
  return Array.from(map.keys())
    .sort((a, b) => a - b)
    .map((k) => map.get(k) as VellumScrapeRun[]);
}

export function VellumScrape({
  versions = DEFAULT_VERSIONS,
  runs = DEFAULT_RUNS,
  depth: controlledDepth,
  defaultDepth = 0,
  onDepthChange,
  onRestore,
  label = "Scrape depth",
  className = "",
}: VellumScrapeProps) {
  const [internalDepth, setInternalDepth] = useState(defaultDepth);
  const depth = controlledDepth ?? internalDepth;

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoredIds, setRestoredIds] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  const railRef = useRef<HTMLInputElement | null>(null);

  const paragraphs = useMemo(() => groupByParagraph(runs), [runs]);
  const maxDepth = Math.max(0, versions.length - 1);
  const version = versions[depth] ?? versions[versions.length - 1];
  const versionNumber = versions.length - depth;

  const valueText = version
    ? `Version ${versionNumber} of ${versions.length}, saved by ${version.author}, ${version.savedAt}`
    : `Version ${versionNumber} of ${versions.length}`;

  const commitDepth = useCallback(
    (next: number) => {
      const clamped = Math.min(maxDepth, Math.max(0, next));
      onDepthChange?.(clamped);
      if (controlledDepth === undefined) setInternalDepth(clamped);

      const revealedParagraphs = new Set<number>();
      for (const run of runs) {
        if (run.revealedAt !== undefined && clamped >= run.revealedAt) {
          revealedParagraphs.add(run.paragraph);
        }
      }
      const count = revealedParagraphs.size;
      const v = versions[clamped] ?? versions[versions.length - 1];
      setAnnouncement(
        `Showing version ${versions.length - clamped} of ${versions.length}` +
          (v ? `, saved by ${v.author}` : "") +
          `: ${count} paragraph${count === 1 ? "" : "s"} differ.`
      );
    },
    [maxDepth, onDepthChange, controlledDepth, runs, versions]
  );

  const onRailInput = (e: ChangeEvent<HTMLInputElement>) => {
    commitDepth(e.target.valueAsNumber);
  };

  const openConfirm = (runId: string) => setConfirmingId(runId);
  const cancelConfirm = () => setConfirmingId(null);

  const confirmRestore = (runId: string) => {
    setRestoredIds((prev) => {
      const next = new Set(prev);
      next.add(runId);
      return next;
    });
    setConfirmingId(null);
    onRestore?.(runId);
  };

  return (
    <div className={`flex items-stretch gap-5 ${className}`}>
      <style>{CSS}</style>

      <div className="ns-vellum-rail relative w-8 shrink-0" data-vellum-rail="">
        <div className="ns-vellum-ticks pointer-events-none absolute inset-y-1 left-1/2 flex -translate-x-1/2 flex-col justify-between">
          {versions.map((v, i) => (
            <span key={v.id} className="ns-vellum-tick" data-crossed={i <= depth || undefined} />
          ))}
        </div>
        <input
          ref={railRef}
          type="range"
          min={0}
          max={maxDepth}
          step={1}
          value={depth}
          onChange={onRailInput}
          aria-label={label}
          aria-valuetext={valueText}
          className="ns-vellum-range"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p aria-live="polite" className="mb-3 font-mono text-[11px] tabular-nums text-ns-muted">
          {announcement || `Showing version ${versionNumber} of ${versions.length}.`}
        </p>

        <div
          className="ns-vellum-doc space-y-4 text-sm leading-relaxed text-foreground"
          style={{ "--scrape-depth": depth } as CSSProperties}
        >
          {paragraphs.map((paraRuns, pIdx) => (
            <p key={pIdx}>
              {paraRuns.map((run) => {
                if (!run.ghost || run.revealedAt === undefined) {
                  return <span key={run.id}>{run.current}</span>;
                }

                const restored = restoredIds.has(run.id);
                const revealed = restored || depth >= run.revealedAt;

                return (
                  <span
                    key={run.id}
                    className="ns-vellum-run"
                    data-restored={restored || undefined}
                    style={{ "--rd": run.revealedAt } as CSSProperties}
                  >
                    <span className="ns-vellum-run-current">{run.current}</span>
                    {revealed && (
                      <span className="ns-vellum-ghost-wrap">
                        <span className="ns-vellum-run-fade">
                          <span className="ns-vellum-badge" aria-hidden="true">
                            {run.overwrittenBy}
                          </span>
                          <span>{run.ghost}</span>
                        </span>
                        {!restored &&
                          (confirmingId === run.id ? (
                            <span
                              className="ns-vellum-confirm"
                              role="group"
                              aria-label={`Confirm restoring the text ${run.overwrittenBy} overwrote here`}
                            >
                              <button
                                type="button"
                                data-restore-confirm=""
                                onClick={() => confirmRestore(run.id)}
                                className="ns-vellum-btn ns-vellum-btn-accent"
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={cancelConfirm}
                                className="ns-vellum-btn"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              data-restore-trigger=""
                              aria-expanded={confirmingId === run.id}
                              aria-label={`Restore the text ${run.overwrittenBy} overwrote here`}
                              onClick={() => openConfirm(run.id)}
                              className="ns-vellum-btn"
                            >
                              Restore
                            </button>
                          ))}
                      </span>
                    )}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const DEFAULT_VERSIONS: VellumScrapeVersion[] = [
  { id: "v9", author: "Dan Okafor", initial: "D", savedAt: "Today 09:14" },
  { id: "v8", author: "Priya Nair", initial: "P", savedAt: "Yesterday 17:40" },
  { id: "v7", author: "Priya Nair", initial: "P", savedAt: "Yesterday 11:02" },
  { id: "v6", author: "Mo Farouk", initial: "M", savedAt: "Tue 16:20" },
  { id: "v5", author: "Dan Okafor", initial: "D", savedAt: "Tue 09:55" },
  { id: "v4", author: "Mo Farouk", initial: "M", savedAt: "Mon 14:02" },
  { id: "v3", author: "Dan Okafor", initial: "D", savedAt: "Mon 08:30" },
  { id: "v2", author: "Priya Nair", initial: "P", savedAt: "Fri 15:11" },
  { id: "v1", author: "Mo Farouk", initial: "M", savedAt: "Fri 09:00" },
];

const DEFAULT_RUNS: VellumScrapeRun[] = [
  { id: "r1", paragraph: 0, current: "The onboarding flow should " },
  {
    id: "r2",
    paragraph: 0,
    current: "greet returning users by first name and ",
    ghost: "show a generic welcome banner and ",
    revealedAt: 0,
    overwrittenBy: "D",
  },
  {
    id: "r3",
    paragraph: 0,
    current: "skip the tutorial for anyone who has completed it before.",
  },
  { id: "r4", paragraph: 1, current: "Rate limiting: " },
  {
    id: "r5",
    paragraph: 1,
    current: "120 requests per minute per API key, ",
    ghost: "60 requests per minute per API key, ",
    revealedAt: 2,
    overwrittenBy: "P",
  },
  { id: "r6", paragraph: 1, current: "with a " },
  {
    id: "r7",
    paragraph: 1,
    current: "soft warning at 80%",
    ghost: "hard cutoff with no warning",
    revealedAt: 5,
    overwrittenBy: "M",
  },
  { id: "r8", paragraph: 1, current: " of the limit." },
  { id: "r9", paragraph: 2, current: "Refunds process " },
  {
    id: "r10",
    paragraph: 2,
    current: "automatically within 24 hours",
    ghost: "manually, reviewed by support",
    revealedAt: 6,
    overwrittenBy: "D",
  },
  { id: "r11", paragraph: 2, current: " of the cancellation request." },
];

const CSS = `
.ns-vellum-rail{ height: 15rem; }
.ns-vellum-ticks{ z-index: 0; }
.ns-vellum-tick{
  width: 10px;
  height: 1px;
  background: var(--border);
  transition: background-color 200ms ease, height 200ms ease;
}
.ns-vellum-tick[data-crossed]{
  height: 2px;
  background: var(--foreground);
}

.ns-vellum-range{
  position: relative;
  z-index: 1;
  writing-mode: vertical-lr;
  width: 8px;
  height: 100%;
  margin: 0 auto;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
  border-radius: 999px;
}
.ns-vellum-range:focus-visible{
  outline: 2px solid var(--ns-accent);
  outline-offset: 3px;
  border-radius: 6px;
}
.ns-vellum-range::-webkit-slider-runnable-track{
  width: 2px;
  background: transparent;
}
.ns-vellum-range::-moz-range-track{
  width: 2px;
  background: transparent;
}
.ns-vellum-range::-webkit-slider-thumb{
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--background);
  border: 2px solid var(--foreground);
  margin-left: -6px;
}
.ns-vellum-range::-moz-range-thumb{
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--background);
  border: 2px solid var(--foreground);
}
.ns-vellum-range:hover::-webkit-slider-thumb,
.ns-vellum-range:focus-visible::-webkit-slider-thumb,
.ns-vellum-range:active::-webkit-slider-thumb{
  border-color: var(--ns-accent);
}
.ns-vellum-range:hover::-moz-range-thumb,
.ns-vellum-range:focus-visible::-moz-range-thumb,
.ns-vellum-range:active::-moz-range-thumb{
  border-color: var(--ns-accent);
}

.ns-vellum-run{
  --show: clamp(0, calc(var(--scrape-depth, 0) - var(--rd, 0) + 1), 1);
}

.ns-vellum-run-current{
  color: color-mix(in srgb, var(--foreground) calc(100% - var(--show) * 65%), var(--ns-muted) calc(var(--show) * 65%));
  opacity: calc(1 - var(--show) * 0.65);
  transition: opacity 420ms ease, color 420ms ease;
}
.ns-vellum-run[data-restored]  .ns-vellum-run-current{
  opacity: 0;
  transition-duration: 500ms;
  transition-timing-function: ${EXPO_OUT};
}

.ns-vellum-run-fade{
  color: var(--foreground);
  opacity: calc(var(--show) * 0.6);
  filter: blur(calc(var(--show) * 0.5px));
  transition: opacity 420ms ease, filter 420ms ease;
}
@starting-style{
  .ns-vellum-run-fade{ opacity: 0; filter: blur(0px); }
}
.ns-vellum-run[data-restored] .ns-vellum-run-fade{
  opacity: 1;
  filter: blur(0px);
  transition-duration: 500ms;
  transition-timing-function: ${EXPO_OUT};
}
.ns-vellum-run[data-restored] .ns-vellum-badge{ display: none; }

.ns-vellum-badge{
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  padding: 0 3px;
  margin-right: 3px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--ns-muted);
  vertical-align: 1px;
}

.ns-vellum-btn{
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  padding: 1px 7px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  color: var(--ns-muted);
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: color 150ms ease, border-color 150ms ease;
}
.ns-vellum-btn:hover,
.ns-vellum-btn:focus-visible{
  color: var(--ns-accent);
  border-color: var(--ns-accent);
}
.ns-vellum-btn:focus-visible{
  outline: 2px solid var(--ns-accent);
  outline-offset: 2px;
}
.ns-vellum-btn-accent{
  color: var(--ns-accent);
  border-color: var(--ns-accent);
}

.ns-vellum-confirm{ display: inline-flex; align-items: center; }

@media (prefers-reduced-motion: reduce){
  .ns-vellum-run-current,
  .ns-vellum-run-fade,
  .ns-vellum-tick{
    transition: none !important;
  }
}
`;

export default VellumScrape;
