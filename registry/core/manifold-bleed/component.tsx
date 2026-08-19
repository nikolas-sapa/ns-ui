"use client";

import { useCallback, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ManifoldBleed — a connected app's standing grants drawn as a valve
// manifold. Each scope is one gate valve sitting right at the header where
// it branches off the account (the reservoir, left) toward the app (right):
// granted means the valve stands open and its line runs full of ink;
// revoking closes the valve and drains that line BACKWARD toward the valve
// itself, because the branch downstream of a closed valve empties, not the
// header behind it — authority returns to its source.
//
// The single governing scalar per row is `fill` (0 or 1, post-ack). Every
// other visual fact is a pure, LINEAR function of it, so no rAF tween is
// needed anywhere — one CSS transition on stroke-dashoffset/stroke-width/
// transform reproduces exactly what animating the scalar itself and
// re-deriving every frame would, because linear maps commute with easing:
//   - stroke-dashoffset = 1 - fill   (pathLength=1 line; the retreating
//     dash edge — rounded via strokeLinecap — IS the meniscus, no separate
//     marker needed)
//   - stroke-width       = 1 + 2*fill (a pressurized full line reads
//     bolder than the hairline it drains down to)
//   - valve-handle angle  = (1 - fill) * 90deg (0 = parallel to flow/open,
//     90 = perpendicular/closed — how a real ball/gate valve handle reads)
// The drained pipe never disappears: its --ns-muted hairline track is
// always rendered underneath the ink, at full length, for every scope —
// that hairline is the permanent record of what was once granted, and the
// list never shortens or removes a row.
//
// Falsifiable constraint: fill changes ONLY after the caller's
// onGrantChange (or, absent one, a short simulated network round trip)
// resolves. Clicking a valve does not touch `fill` — it flips a `pending`
// flag (aria-busy, a "…" status word) and waits; optimistic fill on grant
// is the deliberately forbidden shortcut, because this is the one panel
// whose entire job is telling the truth about what access exists right
// now. A second click on a row already in flight is ignored rather than
// queued or raced.
//
// A11y: each row is a real role=switch button (native <button>, click and
// Space/Enter both work for free) whose accessible name is the scope's own
// label via aria-labelledby, plus aria-describedby pointing at its
// plain-language description and aria-checked mirroring the CONFIRMED
// state (never the optimistic click). A single shared aria-live=polite
// region announces "{label} granted" / "{label} revoked" once the server
// actually confirms — never on the click itself. Every pipe/valve SVG is
// aria-hidden; the graphics are redundant encoding of the real switch
// state and the visible "Active"/"Revoked" status word beside each row,
// never the only carrier of it. prefers-reduced-motion drops every
// transition — fill, stroke-width and valve angle all land on their
// target value in one step, no drain animation, still fully legible via
// the status word and the valve's resting position.
//
// Distinct from transfer-list-siphon (which MOVES members between two
// columns as a bulk transfer gesture with beads that travel and land) and
// from envelope-window (the one-time consent/occlusion moment before a
// grant exists): this is the standing state afterward — a persistent flow
// diagram of continuing draw, where revocation has a direction and always
// leaves a drained line behind rather than removing anything from view.
// ---------------------------------------------------------------------------

export interface ManifoldScope {
  /** stable id, also the value threaded through onGrantChange */
  id: string;
  /** short scope name, e.g. "read:repos" — becomes the switch's accessible name */
  label: string;
  /** plain-language description of what this scope allows */
  description: string;
  /** initial granted state. Default true (most rows on a grants page start granted). */
  defaultGranted?: boolean;
}

export interface ManifoldBleedProps {
  /** the connected app these scopes belong to, e.g. "Northlake CI" */
  appName: string;
  /** the scopes/permissions, rendered top to bottom in this order */
  scopes: ManifoldScope[];
  /**
   * Called with the scope id and the requested next state. Resolve to
   * confirm the change (fill then updates and the row announces); reject
   * (or throw) to leave the grant unchanged. Omit to use a built-in
   * simulated ~320ms round trip, useful for demos without a real backend.
   */
  onGrantChange?: (scopeId: string, granted: boolean) => Promise<void> | void;
  className?: string;
}

const ACK_MS = 320;
const DRAIN_MS = 600;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo: fast off the valve, settles slow — draining under gravity, not a linear pour

function simulateAck(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ACK_MS);
  });
}

export function ManifoldBleed({ appName, scopes, onGrantChange, className = "" }: ManifoldBleedProps) {
  const uid = useId();
  const [granted, setGranted] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const scope of scopes) init[scope.id] = scope.defaultGranted ?? true;
    return init;
  });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [announce, setAnnounce] = useState("");

  const toggle = useCallback(
    async (scope: ManifoldScope) => {
      if (pendingRef.current[scope.id]) return; // already in flight — ignore, don't queue or race
      const next = !(granted[scope.id] ?? true);
      setPending((p) => ({ ...p, [scope.id]: true }));
      try {
        await (onGrantChange?.(scope.id, next) ?? simulateAck());
        setGranted((g) => ({ ...g, [scope.id]: next }));
        setAnnounce(`${scope.label} ${next ? "granted" : "revoked"}`);
      } catch {
        setAnnounce(`${scope.label} unchanged`);
      } finally {
        setPending((p) => {
          const rest = { ...p };
          delete rest[scope.id];
          return rest;
        });
      }
    },
    [granted, onGrantChange]
  );

  return (
    <div className={`w-full max-w-md ${className}`}>
      <style>{CSS}</style>

      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-foreground" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-ns-muted">Your account</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ns-muted">{appName}</span>
          <span aria-hidden className="h-2 w-2 rounded-full border border-border" />
        </div>
      </div>

      <ul className="flex flex-col">
        {scopes.map((scope) => {
          const isGranted = granted[scope.id] ?? true;
          const isPending = !!pending[scope.id];
          const fill = isGranted ? 1 : 0;
          const angle = (1 - fill) * 90;
          const strokeW = 1 + 2 * fill;
          const labelId = `${uid}-${scope.id}-label`;
          const descId = `${uid}-${scope.id}-desc`;

          return (
            <li key={scope.id} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
              <button
                type="button"
                role="switch"
                aria-checked={isGranted}
                aria-labelledby={labelId}
                aria-describedby={descId}
                aria-busy={isPending || undefined}
                data-manifold-scope={scope.id}
                onClick={() => toggle(scope)}
                className="ns-manifold-valve group relative grid h-7 w-7 shrink-0 place-items-center rounded-full outline-none transition-colors duration-150 hover:bg-border/40 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden focusable="false" className="overflow-visible">
                  <circle
                    cx={14}
                    cy={14}
                    r={9}
                    fill="var(--background)"
                    stroke="var(--border)"
                    strokeWidth={1.25}
                    className="ns-manifold-body"
                  />
                  <line
                    className="ns-manifold-handle"
                    x1={14 - 6.5}
                    y1={14}
                    x2={14 + 6.5}
                    y2={14}
                    stroke="var(--foreground)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    style={{ transform: `rotate(${angle}deg)` }}
                  />
                </svg>
              </button>

              <div className="flex min-w-[7.25rem] flex-col">
                <span id={labelId} className="font-mono text-xs text-foreground">
                  {scope.label}
                </span>
                <span id={descId} className="text-[11px] leading-snug text-ns-muted">
                  {scope.description}
                </span>
              </div>

              <div className="flex flex-1 items-center gap-1.5">
                <svg
                  className="h-4 flex-1"
                  viewBox="0 0 100 16"
                  preserveAspectRatio="none"
                  aria-hidden
                  focusable="false"
                >
                  {/* permanent hairline track — evidence of the line even once fully drained */}
                  <line x1={0} y1={8} x2={100} y2={8} stroke="var(--ns-muted)" strokeWidth={1} />
                  {/* ink — the only thing this component ever animates */}
                  <line
                    className="ns-manifold-ink"
                    x1={0}
                    y1={8}
                    x2={100}
                    y2={8}
                    pathLength={1}
                    stroke="var(--foreground)"
                    strokeLinecap="round"
                    strokeDasharray="1 1"
                    style={{ strokeWidth: strokeW, strokeDashoffset: 1 - fill }}
                  />
                </svg>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-border" />
              </div>

              <span
                data-manifold-status={scope.id}
                data-granted={isGranted}
                className="w-14 shrink-0 text-right font-mono text-[10px] uppercase tracking-wide text-ns-muted"
              >
                {isPending ? "…" : isGranted ? "Active" : "Revoked"}
              </span>
            </li>
          );
        })}
      </ul>

      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

const CSS = `
.ns-manifold-ink { transition: stroke-dashoffset ${DRAIN_MS}ms ${EASE}, stroke-width ${DRAIN_MS}ms ${EASE}; }
.ns-manifold-handle { transform-box: fill-box; transform-origin: center; transition: transform ${DRAIN_MS}ms ${EASE}; }
.ns-manifold-body { transition: stroke 150ms ease-out; }
.ns-manifold-valve:hover .ns-manifold-body { stroke: var(--foreground); }
@media (prefers-reduced-motion: reduce) {
  .ns-manifold-ink, .ns-manifold-handle { transition: none; }
}
`;
