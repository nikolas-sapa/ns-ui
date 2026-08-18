"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// DueSlip — a library date-due card for a shared doc: every collaborator who
// opens it gets their initials and an HH:MM stamp pressed into the next free
// ruled row. Row POSITION is reading order — there is no hover state that
// carries meaning, unlike an avatar-stack "seen by" pile, which only reveals
// who's there via pointer interrogation and collapses to a generic "+N" the
// moment the record gets interesting. Here every reader is a permanent line
// item; the only thing that ever collapses is the *visual* overflow past the
// ruled area, and even then a real integer count sits on the card behind it.
//
// One governing scalar, arrival index (a reader's position in the readers
// array), drives every derived visual: row position (plain document order),
// ink alpha (1.0 easing down to a 0.55 floor by the 14th row, so a long
// ledger's tail stays legible instead of vanishing), while rotation is seeded
// independently from a hash of the reader's id (not the index) so re-sorting
// or filtering the same person never reshuffles their tilt. The newest
// arrival plays a 320ms ease-out-expo press-in (scale 1.06 -> 1.0) on just
// the ink chip; the row's static +/-2.5deg tilt is not itself motion and
// stays under reduced-motion, only the spring is stripped.
//
// Fully controlled: `readers` is the only data prop, in arrival order. The
// component holds no ledger state of its own — only transient UI state (which
// ids are mid press-animation, whether the full-name view is open, the live
// announcement). Pure DOM/SVG/CSS, no canvas; every color is one of
// --background / --foreground / --ns-muted / --border / --ns-accent, and
// --ns-accent appears nowhere but the expand control's focus ring.
// ---------------------------------------------------------------------------

export interface DueSlipReader {
  /** stable identifier; also seeds this reader's stamp rotation */
  id: string;
  /** full name, shown once the slip is expanded */
  name: string;
  /** 1-3 char initials; derived from `name` when omitted */
  initials?: string;
  /** when this reader first opened the doc */
  readAt: number | Date;
}

export interface DueSlipProps {
  /** readers in arrival order — index 0 opened first */
  readers: DueSlipReader[];
  /** accessible name for the ledger list, also shown as the card title. @default "Read receipts" */
  label?: string;
  /** rows visible in the ruled card before overflow flips to a second card behind. @default 6 */
  visibleRows?: number;
  /** row count over which ink alpha ramps from 1.0 down to its 0.55 floor. @default 14 */
  alphaFloorRow?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

const PRESS_MS = 320;
const ALPHA_FLOOR = 0.55;

function toDate(v: number | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic tilt from the reader's id, not their row index, so the same
// person keeps the same stamp angle no matter where they land in the list.
function stampRotate(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const s = Math.sin(h) * 43758.5453;
  const frac = s - Math.floor(s);
  return (frac - 0.5) * 5; // -2.5..2.5deg
}

function inkAlpha(index: number, floorRow: number): number {
  if (floorRow <= 1) return ALPHA_FLOOR;
  const t = Math.min(1, Math.max(0, index) / (floorRow - 1));
  return 1 - t * (1 - ALPHA_FLOOR);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function ChevronGlyph({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="11"
      height="11"
      fill="none"
      aria-hidden="true"
      className="ns-due-chevron"
      data-expanded={expanded}
    >
      <path d="M5 3.5 10 8l-5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DueSlip({
  readers,
  label = "Read receipts",
  visibleRows = 6,
  alphaFloorRow = 14,
  className = "",
}: DueSlipProps) {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [arrivingIds, setArrivingIds] = useState<Set<string>>(() => new Set());
  const [liveMsg, setLiveMsg] = useState("");
  const prevIdsRef = useRef<Set<string> | null>(null);

  // New arrivals only: the first render seeds prevIdsRef without animating
  // (those rows are history, not something that just happened), every render
  // after that diffs against the previous id set.
  useEffect(() => {
    const prev = prevIdsRef.current;
    const nowIds = new Set(readers.map((r) => r.id));
    if (prev) {
      const newcomers = readers.filter((r) => !prev.has(r.id));
      if (newcomers.length > 0) {
        const last = newcomers[newcomers.length - 1];
        setLiveMsg(`Read by ${last.name}, ${formatHHMM(toDate(last.readAt))}`);
        if (!reducedMotion) {
          setArrivingIds((cur) => {
            const next = new Set(cur);
            for (const r of newcomers) next.add(r.id);
            return next;
          });
          for (const r of newcomers) {
            const id = r.id;
            window.setTimeout(() => {
              setArrivingIds((cur) => {
                if (!cur.has(id)) return cur;
                const next = new Set(cur);
                next.delete(id);
                return next;
              });
            }, PRESS_MS);
          }
        }
      }
    }
    prevIdsRef.current = nowIds;
  }, [readers, reducedMotion]);

  const visible = expanded ? readers : readers.slice(0, visibleRows);
  const overflow = expanded ? 0 : Math.max(0, readers.length - visibleRows);

  return (
    <div
      className={["ns-due-wrap", className].join(" ")}
      data-reduced={reducedMotion || undefined}
    >
      {overflow > 0 && (
        <div className="ns-due-ghost" aria-hidden="true">
          <span className="ns-due-ghost-count">+{overflow}</span>
        </div>
      )}

      <div className="ns-due-card" data-expanded={expanded || undefined}>
        <button
          type="button"
          className="ns-due-trigger"
          aria-expanded={expanded}
          aria-label={`Expand ${label} to show full names`}
          onClick={() => setExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && expanded) {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(false);
            }
          }}
        >
          <span className="ns-due-trigger-title">{label}</span>
          <ChevronGlyph expanded={expanded} />
        </button>

        <ol role="list" aria-label={label} className="ns-due-rows" data-scroll={expanded || undefined}>
          {visible.map((r, i) => {
            const date = toDate(r.readAt);
            const hhmm = formatHHMM(date);
            const initials = (r.initials?.slice(0, 3).toUpperCase()) || initialsOf(r.name);
            const rotate = stampRotate(r.id);
            const alpha = inkAlpha(i, alphaFloorRow);
            const arriving = arrivingIds.has(r.id);

            return (
              <li
                key={r.id}
                aria-label={`Read by ${r.name}, ${hhmm}`}
                className="ns-due-row"
                data-arriving={arriving || undefined}
                style={
                  {
                    "--due-rotate": `${rotate.toFixed(2)}deg`,
                    "--due-ink": `${(alpha * 100).toFixed(1)}%`,
                  } as Vars
                }
              >
                <span className="ns-due-stamp">
                  <span className="ns-due-ink">{initials}</span>
                </span>
                {expanded && <span className="ns-due-name">{r.name}</span>}
                <time dateTime={date.toISOString()} className="ns-due-time">
                  {hhmm}
                </time>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="ns-due-empty" aria-hidden="true">
              No reads yet
            </li>
          )}
        </ol>
      </div>

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>

      <style>{`
.ns-due-wrap{position:relative;display:inline-block;width:100%;padding-right:4px;padding-bottom:4px}
.ns-due-ghost{position:absolute;top:4px;left:4px;right:0;bottom:0;z-index:0;border-radius:12px;border:1px solid var(--border);background:var(--background);pointer-events:none;display:flex;align-items:flex-end;justify-content:flex-end;padding:8px 12px}
.ns-due-ghost-count{font-family:var(--font-mono);font-size:12px;color:var(--ns-muted)}
.ns-due-card{position:relative;z-index:1;width:100%;border-radius:12px;border:1px solid var(--border);background:var(--background);overflow:hidden}
.ns-due-trigger{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:none;border-bottom:1px solid var(--border);background:transparent;color:var(--foreground);font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;outline:none;transition:background-color 150ms ease-out}
.ns-due-trigger:hover{background:color-mix(in srgb, var(--foreground) 5%, transparent)}
.ns-due-trigger:focus-visible{outline:2px solid var(--ns-accent);outline-offset:-2px;border-radius:6px}
.ns-due-chevron{color:var(--ns-muted);transition:transform 180ms cubic-bezier(0.22,1,0.36,1)}
.ns-due-chevron[data-expanded="true"]{transform:rotate(90deg)}
.ns-due-rows{list-style:none;margin:0;padding:0}
.ns-due-rows[data-scroll]{max-height:280px;overflow-y:auto}
.ns-due-row{display:flex;align-items:baseline;gap:10px;min-height:28px;padding:4px 12px}
.ns-due-row + .ns-due-row{border-top:1px solid var(--border)}
.ns-due-empty{padding:10px 12px;font-family:var(--font-mono);font-size:12px;color:var(--ns-muted)}
.ns-due-stamp{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:20px;padding:0 5px;border:1px solid var(--border);border-radius:6px;rotate:var(--due-rotate, 0deg);transform-origin:center}
.ns-due-ink{font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.02em;color:color-mix(in srgb, var(--foreground) var(--due-ink, 100%), var(--ns-muted))}
.ns-due-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:12px;color:color-mix(in srgb, var(--foreground) var(--due-ink, 100%), var(--ns-muted))}
.ns-due-time{margin-left:auto;flex-shrink:0;font-family:var(--font-mono);font-size:11px;color:var(--ns-muted)}
.ns-due-row[data-arriving="true"] .ns-due-stamp{animation:ns-due-press ${PRESS_MS}ms cubic-bezier(0.16,1,0.3,1) both}
@keyframes ns-due-press{from{scale:1.06}to{scale:1}}
.ns-due-wrap[data-reduced] .ns-due-row[data-arriving="true"] .ns-due-stamp{animation:none}
.ns-due-wrap[data-reduced] .ns-due-chevron{transition:none}
.ns-due-wrap[data-reduced] .ns-due-trigger{transition:none}
@media (prefers-reduced-motion: reduce){
  .ns-due-row[data-arriving="true"] .ns-due-stamp{animation:none}
  .ns-due-chevron,.ns-due-trigger{transition:none}
}
`}</style>
    </div>
  );
}
