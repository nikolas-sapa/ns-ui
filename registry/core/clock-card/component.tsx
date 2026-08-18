"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ClockCardRack — the "what happened while I was away" digest, built as a
// punch-clock card rack: one radius-12 bordered card per collaborator, each
// holding their own work bursts as real punched rows ("edited section 2 —
// 14:10 to 14:32"). No interleaved anonymous feed — every row lives on its
// author's card, so the rhythm of one person's morning reads at a glance
// instead of needing per-line avatar decoding.
//
// Time is the only governing scalar. It drives three things, never set
// independently: (1) row order inside a card — latest punch first; (2) rack
// order across cards — the card with the most recent punch anywhere on it
// sits on top, recomputed on every render, never a stored index; (3) how
// PROUD an unread card sits. Every card shares one top datum (the hairline
// at the head of the rack) and cards holding unread bursts float up to 6px
// above their flush resting position — `2px + 1px per 12 unread hours`,
// clamped at 6px so a two-week vacation's backlog can't shove a card off the
// rack the way an unclamped scalar would. The clamp is the point: proudness
// reads as "there is unread work here", not "here is how much".
//
// Marking a card read is a real per-card "Mark caught up" button, never a
// passive read-on-view — settle is a pure transform transition (300ms
// ease-out-expo) off the offset above, so it costs no layout. A brand new
// punch row plays a single vertical clip reveal on the render it first
// appears (detected by diffing burst ids against the previous commit in a
// layout effect, so the reveal starts on the very first paint rather than
// flashing open then replaying) — like a card dropped into the slot.
//
// Fully controlled: `collaborators` is the only model, rows carry their own
// `unread` flag, the rack derives every sort/offset from it and holds no
// copy of the model itself. "Mark caught up" is reported via a callback,
// the caller flips the flags. Local state is transient UI only: which
// burst ids are still mid-reveal-animation and the aria-live announcement
// text. Colors are CSS custom properties only (--background, --foreground,
// --ns-muted, --border, --ns-accent via the bg-ns-accent/text-white utility
// pair already standard across this registry's buttons) — never a literal —
// so both themes render correctly. Differs from memory-ledger-decay
// (patina-ledger): that component ages a record by tarnishing its ink on a
// color ramp; this one never recolors anything for unread state — unread is
// a physical position along a datum line, settled by a button, not a decay
// curve read off elapsed time. Pure DOM + CSS + real <time> elements, no
// canvas. prefers-reduced-motion swaps the proud/flush states directly with
// no 300ms settle and skips the row-reveal animation entirely; nothing
// becomes unreachable, it just stops moving.
// ---------------------------------------------------------------------------

export interface ClockCardBurst {
  /** stable id, unique within its collaborator */
  id: string;
  /** what happened, e.g. "edited section 2" */
  section: string;
  /** ISO datetime the burst started */
  start: string;
  /** ISO datetime the burst ended */
  end: string;
  /** unread bursts hold their card proud of the rack. default false */
  unread?: boolean;
}

export interface ClockCardCollaborator {
  /** stable id */
  id: string;
  /** person's name — becomes the card's accessible name */
  name: string;
  /** work bursts for this person, any order — the component sorts them */
  bursts: ClockCardBurst[];
}

export interface ClockCardRackProps {
  /** one card per collaborator — fully controlled, the rack derives everything else */
  collaborators: ClockCardCollaborator[];
  /** fires when a card's "Mark caught up" button is pressed; caller clears that card's unread flags */
  onMarkCaughtUp?: (collaboratorId: string) => void;
  /** accessible name for the rack region. default "Catch-up digest" */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const MAX_PROUD_PX = 6;
const BASE_PROUD_PX = 2;
const HOUR_MS = 3_600_000;

function safeTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function formatClock(iso: string): string {
  const t = safeTime(iso);
  if (!t) return "--:--";
  return new Date(t).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function proudOffsetPx(bursts: ClockCardBurst[]): number {
  let unreadHours = 0;
  let unreadCount = 0;
  for (const b of bursts) {
    if (!b.unread) continue;
    unreadCount++;
    unreadHours += Math.max(0, safeTime(b.end) - safeTime(b.start)) / HOUR_MS;
  }
  if (unreadCount === 0) return 0;
  return Math.min(MAX_PROUD_PX, BASE_PROUD_PX + unreadHours / 12);
}

function latestPunch(bursts: ClockCardBurst[]): number {
  let latest = -Infinity;
  for (const b of bursts) latest = Math.max(latest, safeTime(b.end));
  return latest;
}

export function ClockCardRack({
  collaborators,
  onMarkCaughtUp,
  ariaLabel = "Catch-up digest",
  className = "",
}: ClockCardRackProps) {
  const uid = useId();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set());
  const [liveMsg, setLiveMsg] = useState("");
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Detect brand-new burst rows synchronously before paint, so the very
  // first frame already renders them clipped-closed rather than flashing
  // open once, then replaying closed->open a frame later.
  useLayoutEffect(() => {
    const allIds = new Set<string>();
    for (const c of collaborators) for (const b of c.bursts) allIds.add(b.id);

    const seen = seenIdsRef.current;
    if (seen === null) {
      // first mount: nothing "enters", it's just the initial render
      seenIdsRef.current = allIds;
      return;
    }

    const fresh = new Set<string>();
    for (const id of allIds) if (!seen.has(id)) fresh.add(id);
    seenIdsRef.current = allIds;

    if (fresh.size === 0 || reducedMotion) return;
    setEnteringIds((prev) => new Set([...prev, ...fresh]));
    const t = window.setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev);
        for (const id of fresh) next.delete(id);
        return next;
      });
    }, 360);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaborators, reducedMotion]);

  const sorted = [...collaborators].sort(
    (a, b) => latestPunch(b.bursts) - latestPunch(a.bursts)
  );

  function markCaughtUp(c: ClockCardCollaborator) {
    onMarkCaughtUp?.(c.id);
    setLiveMsg(`Caught up with ${c.name}`);
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={["ns-clockcard-rack", className].join(" ")}
    >
      <style>{`
.ns-clockcard-datum{height:1px;background:var(--border);margin-bottom:10px}
.ns-clockcard-slots{display:flex;flex-direction:column;gap:10px;padding-top:${MAX_PROUD_PX}px}
.ns-clockcard-card{border-radius:12px;border:1px solid var(--border);background:var(--background);transform:translateY(calc(-1 * var(--nsc-offset, 0px)));transition:transform 300ms cubic-bezier(.16,1,.3,1)}
.ns-clockcard-head{display:flex;align-items:baseline;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)}
.ns-clockcard-name{margin:0;font-size:13px;font-weight:600;color:var(--foreground)}
.ns-clockcard-count{font-family:var(--font-mono, ui-monospace, monospace);font-size:11px;color:var(--ns-muted)}
.ns-clockcard-caughtup{margin-left:auto;flex-shrink:0;border-radius:6px;background:var(--ns-accent);color:var(--background);font-size:11px;font-weight:500;padding:5px 10px;transition:opacity 150ms ease-out}
.ns-clockcard-caughtup:hover:not(:disabled){opacity:0.82}
.ns-clockcard-caughtup:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-clockcard-caughtup:disabled{opacity:0.4;pointer-events:none;cursor:not-allowed}
.ns-clockcard-rows{list-style:none;margin:0;padding:0}
.ns-clockcard-row{overflow:hidden}
.ns-clockcard-row + .ns-clockcard-row{border-top:1px solid var(--border)}
.ns-clockcard-row-clip{padding:7px 12px;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 8px}
.ns-clockcard-row[data-entering="true"] .ns-clockcard-row-clip{animation:ns-clockcard-reveal 340ms cubic-bezier(.16,1,.3,1) both}
@keyframes ns-clockcard-reveal{from{clip-path:inset(0 0 100% 0);opacity:0}to{clip-path:inset(0 0 0% 0);opacity:1}}
.ns-clockcard-section{font-size:12.5px;color:var(--foreground);min-width:0}
.ns-clockcard-times{font-family:var(--font-mono, ui-monospace, monospace);font-size:11.5px;color:var(--ns-muted);white-space:nowrap;margin-left:auto}
.ns-clockcard-empty{padding:10px 12px;font-size:12px;color:var(--ns-muted)}
@media (prefers-reduced-motion: reduce){
  .ns-clockcard-card{transition:none!important}
  .ns-clockcard-row[data-entering="true"] .ns-clockcard-row-clip{animation:none!important}
  .ns-clockcard-caughtup{transition:none!important}
}
`}</style>

      <div aria-hidden="true" className="ns-clockcard-datum" />

      <div className="ns-clockcard-slots">
        {sorted.map((c) => {
          const bursts = [...c.bursts].sort(
            (a, b) => safeTime(b.start) - safeTime(a.start)
          );
          const unreadCount = bursts.filter((b) => b.unread).length;
          const offset = proudOffsetPx(bursts);
          const headingId = `${uid}-${c.id}-name`;
          const countText =
            unreadCount > 0
              ? `${unreadCount} unread burst${unreadCount === 1 ? "" : "s"}`
              : "Caught up";

          return (
            <section
              key={c.id}
              aria-labelledby={headingId}
              data-proud={unreadCount > 0}
              className="ns-clockcard-card"
              style={{ "--nsc-offset": `${offset}px` } as React.CSSProperties}
            >
              <header className="ns-clockcard-head">
                <h3 id={headingId} className="ns-clockcard-name">
                  {c.name}
                </h3>
                <span className="ns-clockcard-count">{countText}</span>
                <button
                  type="button"
                  onClick={() => markCaughtUp(c)}
                  disabled={unreadCount === 0}
                  aria-label={`Mark ${c.name} caught up`}
                  className="ns-clockcard-caughtup"
                >
                  Mark caught up
                </button>
              </header>

              {bursts.length === 0 ? (
                <p className="ns-clockcard-empty">No activity yet.</p>
              ) : (
                <ul role="list" className="ns-clockcard-rows">
                  {bursts.map((b) => (
                    <li
                      key={b.id}
                      data-entering={enteringIds.has(b.id)}
                      className="ns-clockcard-row"
                    >
                      <div className="ns-clockcard-row-clip">
                        <span className="ns-clockcard-section">{b.section}</span>
                        <span className="ns-clockcard-times">
                          <time dateTime={b.start}>{formatClock(b.start)}</time>
                          {" – "}
                          <time dateTime={b.end}>{formatClock(b.end)}</time>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </div>
  );
}
