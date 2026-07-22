"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PatinaLedger — the "what does it think it knows about me right now" panel.
// One 32px row per remembered fact, 13px Geist Mono, inside a 12px-radius
// rail. Ink is literally time: an unreferenced row steps its color down a
// four-stop ramp from --foreground toward --muted (fresh -> aging -> fading
// -> dormant) on a 600ms transition every turn it goes unused, so aging is
// perceptible at each turn boundary rather than a silent jump. The moment the
// agent actually cites a row in a reply, its color SNAPS back to --foreground
// (transition suppressed for that one commit, not eased — a discontinuity
// reads as "revived now" the way a slow brighten wouldn't) and a 1px
// --foreground underline wipes left-to-right under the text over 300ms
// before fading, so rehearsal is visible as an event, not just a color.
//
// Users govern the ledger, they don't just read it: pin stamps a 4px
// --foreground lacquer dot and permanently exempts the row from fading
// (data-age flips to "pinned", never advances); evict is a real two-step
// confirm — first press arms the row (label + button both announce
// "confirm"), second press collapses it via grid-template-rows 1fr->0fr +
// opacity, 250ms, then the row is handed to the caller to actually remove.
// Rows that fully dormant (unpinned, past the last threshold) leave the main
// list and fold into a "N dormant" disclosure at the bottom so the rail
// doesn't grow unbounded with things nobody's used in ages; expanding it
// reveals them inline, still with working pin/evict, so pinning a dormant
// row rescues it back into the main list on the next render for free.
//
// Fully controlled: memories + turn are props, the component derives every
// row's age from `turn - lastUsedTurn` and holds no model state of its own —
// pin/evict are reported via callbacks, the caller owns the array. The only
// local state is transient UI: which row is armed-for-evict, which rows are
// mid-collapse, whether the dormant drawer is open, and a short-lived
// "just cited" flag used to drive the wipe + a single aria-live
// announcement. Colors are CSS custom properties only (--foreground,
// --muted, --border, --background) via color-mix(), never a literal, so
// both themes render correctly. Because color alone is invisible to a
// screen reader, every row's accessible name spells the age out in words —
// "remembers: prefers metric units — fading, 6 turns unused" — and pin/evict
// are real, separately-labelled, keyboard-reachable buttons. Under
// prefers-reduced-motion every wipe, fade and collapse animation is
// replaced by an instant state change; nothing becomes unreachable or
// unreadable, it just stops moving.
// ---------------------------------------------------------------------------

export interface PatinaMemory {
  /** stable identifier */
  id: string;
  /** the remembered fact, rendered verbatim in 13px Geist Mono */
  text: string;
  /** turn index this memory was last referenced or rehearsed */
  lastUsedTurn: number;
  /** pinned rows never fade and carry a lacquer dot */
  pinned?: boolean;
}

export interface PatinaLedgerProps {
  memories: PatinaMemory[];
  /** current turn index — advances as the conversation proceeds */
  turn: number;
  /**
   * turns-unused boundaries between fresh/aging/fading/dormant.
   * default [1, 4, 9] (0 turns = fresh, 1-3 = aging, 4-8 = fading, 9+ = dormant)
   */
  ageThresholds?: readonly [number, number, number];
  onPinToggle?: (id: string, pinned: boolean) => void;
  /** called once a row's evict collapse animation has finished */
  onEvict?: (id: string) => void;
  /** accessible name for the ledger list. default "Session memory" */
  ariaLabel?: string;
  className?: string;
}

type AgeStop = 0 | 1 | 2 | 3;

function computeStop(turnsUnused: number, th: readonly [number, number, number]): AgeStop {
  const u = Math.max(0, turnsUnused);
  if (u < th[0]) return 0;
  if (u < th[1]) return 1;
  if (u < th[2]) return 2;
  return 3;
}

function ageWords(stop: AgeStop, turnsUnused: number, pinned: boolean): string {
  if (pinned) return "pinned";
  if (stop === 0) return "fresh";
  const n = Math.max(0, turnsUnused);
  const unit = n === 1 ? "turn" : "turns";
  const word = stop === 1 ? "aging" : stop === 2 ? "fading" : "dormant";
  return `${word}, ${n} ${unit} unused`;
}

function PinGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path
        d="M8 1.5 9.6 5l3.4.5-2.6 2.4.7 3.5L8 9.7 5 11.4l.7-3.5-2.6-2.4L6.5 5 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8 11.4v3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function EvictGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ChevronGlyph({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="11"
      height="11"
      fill="none"
      aria-hidden="true"
      className="ns-patina-chevron"
      data-expanded={expanded}
    >
      <path d="M5 3.5 10 8l-5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PatinaLedger({
  memories,
  turn,
  ageThresholds = [1, 4, 9],
  onPinToggle,
  onEvict,
  ariaLabel = "Session memory",
  className = "",
}: PatinaLedgerProps) {
  const uid = useId();
  const [armedId, setArmedId] = useState<string | null>(null);
  const [collapsingIds, setCollapsingIds] = useState<Set<string>>(() => new Set());
  const [expandedDormant, setExpandedDormant] = useState(false);
  const [justCited, setJustCited] = useState<{ id: string; key: number } | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Detect rehearsal: any memory whose lastUsedTurn just increased. Compared
  // against the previous render's snapshot, not derived from `turn` alone,
  // so a memory can be cited on any turn without every sibling re-triggering.
  useEffect(() => {
    const prev = prevRef.current;
    for (const m of memories) {
      const before = prev.get(m.id);
      if (before !== undefined && m.lastUsedTurn > before) {
        setJustCited({ id: m.id, key: Date.now() + Math.random() });
        setLiveMsg(`Rehearsed: ${m.text} — turn ${m.lastUsedTurn}`);
      }
    }
    prevRef.current = new Map(memories.map((m) => [m.id, m.lastUsedTurn]));
  }, [memories]);

  useEffect(() => {
    if (!justCited) return;
    const t = window.setTimeout(() => {
      setJustCited((cur) => (cur?.key === justCited.key ? null : cur));
    }, 900);
    return () => window.clearTimeout(t);
  }, [justCited]);

  const rows = memories.map((m) => {
    const turnsUnused = Math.max(0, turn - m.lastUsedTurn);
    const stop = computeStop(turnsUnused, ageThresholds);
    const dormant = !m.pinned && stop === 3;
    return { ...m, turnsUnused, stop, dormant };
  });

  const visible = rows.filter((r) => !r.dormant);
  const dormantRows = rows.filter((r) => r.dormant);

  function requestEvict(id: string) {
    if (armedId === id) {
      setArmedId(null);
      setCollapsingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      const delay = reducedMotion ? 0 : 260;
      window.setTimeout(() => {
        setCollapsingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        onEvict?.(id);
      }, delay);
    } else {
      setArmedId(id);
    }
  }

  function renderRow(r: (typeof rows)[number]) {
    const armed = armedId === r.id;
    const collapsing = collapsingIds.has(r.id);
    const cited = justCited?.id === r.id;
    const dataAge = r.pinned ? "pinned" : String(r.stop);
    const label = `Remembers: ${r.text} — ${ageWords(r.stop, r.turnsUnused, !!r.pinned)}`;

    return (
      <li
        key={r.id}
        aria-label={label}
        data-age={dataAge}
        data-collapsing={collapsing}
        data-justcited={cited}
        className="ns-patina-row"
      >
        <div className="ns-patina-row-clip">
          <div className="flex h-8 items-center gap-2 px-3">
            <span aria-hidden="true" className="ns-patina-dot" data-visible={!!r.pinned} />
            <span className="ns-patina-text relative min-w-0 flex-1 truncate font-mono text-[13px]">
              {r.text}
              <span aria-hidden="true" className="ns-patina-wipe" />
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-pressed={!!r.pinned}
                aria-label={`${r.pinned ? "Unpin" : "Pin"} memory: ${r.text}`}
                onClick={() => onPinToggle?.(r.id, !r.pinned)}
                data-active={!!r.pinned}
                className="ns-patina-btn"
              >
                <PinGlyph />
              </button>
              <button
                type="button"
                aria-label={armed ? `Confirm evict: ${r.text}` : `Evict memory: ${r.text}`}
                onClick={() => requestEvict(r.id)}
                onBlur={() => setArmedId((cur) => (cur === r.id ? null : cur))}
                data-armed={armed}
                className="ns-patina-btn"
              >
                <EvictGlyph />
              </button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className={["ns-patina", className].join(" ")}>
      <style>{`
.ns-patina-list{overflow:hidden}
.ns-patina-row{display:grid;grid-template-rows:1fr;opacity:1;transition:grid-template-rows 250ms cubic-bezier(.22,1,.36,1),opacity 250ms ease-out}
.ns-patina-row[data-collapsing="true"]{grid-template-rows:0fr;opacity:0}
.ns-patina-row-clip{overflow:hidden;min-height:0}
.ns-patina-row + .ns-patina-row > .ns-patina-row-clip{border-top:1px solid var(--border)}
.ns-patina-text{color:var(--foreground);transition:color 600ms ease-out}
.ns-patina-row[data-age="1"] .ns-patina-text{color:color-mix(in srgb, var(--foreground) 68%, var(--muted))}
.ns-patina-row[data-age="2"] .ns-patina-text{color:color-mix(in srgb, var(--foreground) 36%, var(--muted))}
.ns-patina-row[data-age="3"] .ns-patina-text{color:var(--muted)}
.ns-patina-row[data-age="pinned"] .ns-patina-text{color:var(--foreground)}
.ns-patina-row[data-justcited="true"] .ns-patina-text{transition:none}
.ns-patina-wipe{position:absolute;left:0;right:0;bottom:-3px;height:1px;background:var(--foreground);opacity:0;transform:scaleX(0);transform-origin:left}
.ns-patina-row[data-justcited="true"] .ns-patina-wipe{animation:ns-patina-wipe-in 300ms cubic-bezier(.22,1,.36,1) forwards,ns-patina-wipe-out 300ms ease-in 600ms forwards}
@keyframes ns-patina-wipe-in{from{transform:scaleX(0);opacity:1}to{transform:scaleX(1);opacity:1}}
@keyframes ns-patina-wipe-out{from{opacity:1}to{opacity:0}}
.ns-patina-dot{width:0;height:4px;border-radius:9999px;background:var(--foreground);opacity:0;transition:width 200ms ease-out,opacity 200ms ease-out}
.ns-patina-dot[data-visible="true"]{width:4px;opacity:1}
.ns-patina-btn{display:inline-flex;height:22px;width:22px;align-items:center;justify-content:center;border-radius:6px;color:var(--muted);transition:background-color 150ms ease-out,color 150ms ease-out}
.ns-patina-btn:hover{background:color-mix(in srgb, var(--foreground) 8%, transparent);color:var(--foreground)}
.ns-patina-btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.ns-patina-btn[data-active="true"]{color:var(--foreground)}
.ns-patina-btn[data-armed="true"]{background:color-mix(in srgb, var(--foreground) 14%, transparent);color:var(--foreground)}
.ns-patina-dormant-btn{color:var(--muted);transition:color 150ms ease-out}
.ns-patina-dormant-btn:hover{color:var(--foreground)}
.ns-patina-dormant-btn:focus-visible{outline:2px solid var(--accent);outline-offset:-1px;border-radius:6px}
.ns-patina-chevron{transition:transform 200ms cubic-bezier(.22,1,.36,1)}
.ns-patina-chevron[data-expanded="true"]{transform:rotate(90deg)}
.ns-patina-dormant-wrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows 300ms cubic-bezier(.22,1,.36,1)}
.ns-patina-dormant-wrap[data-expanded="true"]{grid-template-rows:1fr}
.ns-patina-dormant-clip{overflow:hidden;min-height:0}
@media (prefers-reduced-motion: reduce){
  .ns-patina-row,.ns-patina-text,.ns-patina-dot,.ns-patina-dormant-wrap,.ns-patina-chevron,.ns-patina-btn,.ns-patina-dormant-btn{transition:none!important}
  .ns-patina-wipe{animation:none!important;opacity:0!important}
}
`}</style>

      <ul role="list" aria-label={ariaLabel} className="ns-patina-list rounded-xl border border-border bg-background">
        {visible.map(renderRow)}
        {dormantRows.length > 0 ? (
          <li className="ns-patina-row" data-age="pinned">
            <div className="ns-patina-row-clip">
              <div className="flex h-8 items-center px-3">
                <button
                  type="button"
                  data-dormant-toggle="true"
                  aria-expanded={expandedDormant}
                  aria-controls={`${uid}-dormant`}
                  aria-label={`${expandedDormant ? "Collapse" : "Expand"} ${dormantRows.length} dormant ${
                    dormantRows.length === 1 ? "memory" : "memories"
                  }`}
                  onClick={() => setExpandedDormant((v) => !v)}
                  className="ns-patina-dormant-btn flex w-full items-center gap-1.5 font-mono text-[13px]"
                >
                  <ChevronGlyph expanded={expandedDormant} />
                  <span>{dormantRows.length} dormant</span>
                </button>
              </div>
            </div>
          </li>
        ) : null}
      </ul>

      {dormantRows.length > 0 ? (
        <div className="ns-patina-dormant-wrap" data-expanded={expandedDormant}>
          <div className="ns-patina-dormant-clip">
            <ul
              id={`${uid}-dormant`}
              role="list"
              aria-label="Dormant memories"
              className="ns-patina-list mt-2 rounded-xl border border-border bg-background"
            >
              {dormantRows.map(renderRow)}
            </ul>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </div>
  );
}
