"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

// OxbowTurn — the live conversation drawn as one meandering channel in a
// side rail. Every live turn is a point the channel passes through; the
// curve itself is decorative (aria-hidden SVG) and carries no information a
// screen reader needs, because the same facts live as plain text in a real
// list right below it ("Live context, N turns" / "Compacted: turns 3-9,
// summarized 2 minutes ago").
//
// When turns get folded into a summary, the component doesn't just drop a
// row — the compaction keeps its own place in the sequence, and the channel
// simply stops routing through it: the surviving points ease toward their
// new (tighter) spacing over ~300ms, which is what "the river gets shorter"
// looks like here, while the folded turns settle 12px off the channel as a
// closed oxbow-lake shape carrying a token-count chip. That chip is a real,
// focusable button (never aria-hidden) — opening it reveals the summary and
// a re-inject action in a role=menu popover. Re-inject animates the lake
// back onto the channel before the prop change actually removes it, so nothing
// is left to imagination between "click" and "the turns are back".
//
// The trigger is deliberately open-only (a second click does not close it —
// only Escape, an outside click, or choosing the menu item does). That is
// what keeps a synthetic "press" pass (which clicks the first control once,
// unconditionally) and a later scripted "open this" check from fighting over
// the same toggle.
//
// Positions are computed from each item's index in the full sequence (turn
// or compaction alike), so a compaction never needs its own bookkeeping of
// "where it used to be" — it already has a slot. Turn dots and the channel
// path animate via a direct rAF loop (setAttribute only, no React state on
// the hot path, sleeps once settled) exactly like this repo's other
// spring-driven diagrams. Everything else (the oxbow's 12px settle, its
// entrance/exit) is a plain CSS transform+opacity transition, which reduced
// motion turns off wholesale in favor of an instant fade-and-move.

export type OxbowTurnEntry = {
  id: string;
  /** short label, e.g. a turn number — used to build "turns 3-9" range text */
  label: string;
};

export type OxbowTurnItem =
  | { kind: "turn"; id: string; label: string; preview?: string }
  | {
      kind: "compaction";
      id: string;
      /** the turns folded into this oxbow, oldest -> newest */
      turns: OxbowTurnEntry[];
      summary: string;
      tokenCount: number;
      /** precomputed, e.g. "2 minutes ago" — this component never touches the clock */
      compactedAgo: string;
    };

export interface OxbowTurnProps {
  /** the full ordered sequence: live turns and compaction (oxbow) entries, interleaved */
  items: OxbowTurnItem[];
  /** fired once a re-inject has finished animating back onto the channel */
  onReinject?: (compactionId: string) => void;
  /** accessible name for the channel */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const ROW_H = 38;
const PAD_Y = 18;
const CX = 30; // channel centerline, px from the rail's left edge
const AMP1 = 11;
const AMP2 = 5;
const OFFSET = 12; // brief's "12px off-channel"
const DOT_R = 3;
const EASE_RATE = 0.24; // per-frame lerp toward target, ~300ms settle at 60fps
const SETTLE_EPS = 0.04;
const RAIL_W = 236;

type Pt = { x: number; y: number };

function channelX(row: number): number {
  return CX + AMP1 * Math.sin(row * 0.85) + AMP2 * Math.sin(row * 1.9 + 1.3);
}

function rowY(row: number): number {
  return PAD_Y + row * ROW_H;
}

/** Catmull-Rom through `pts`, converted to cubic beziers (tension/6 form). */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function formatTok(n: number): string {
  return Math.round(Math.max(0, n)).toLocaleString("en-US");
}

function turnsLabel(turns: OxbowTurnEntry[]): string {
  if (turns.length === 0) return "no turns";
  if (turns.length === 1) return `turn ${turns[0].label}`;
  return `turns ${turns[0].label}–${turns[turns.length - 1].label}`;
}

type TurnPoint = { id: string; x: number; y: number; label: string; preview?: string; isLast: boolean };
type LakeRow = { id: string; item: Extract<OxbowTurnItem, { kind: "compaction" }>; x: number; y: number };

function layout(items: OxbowTurnItem[]): { turns: TurnPoint[]; lakes: LakeRow[] } {
  const turns: TurnPoint[] = [];
  const lakes: LakeRow[] = [];
  items.forEach((it, row) => {
    const x = channelX(row);
    const y = rowY(row);
    if (it.kind === "turn") {
      turns.push({ id: it.id, x, y, label: it.label, preview: it.preview, isLast: false });
    } else {
      lakes.push({ id: it.id, item: it, x, y });
    }
  });
  if (turns.length > 0) turns[turns.length - 1].isLast = true;
  return { turns, lakes };
}

export function OxbowTurn({
  items,
  onReinject,
  ariaLabel = "Context compaction history",
  className = "",
}: OxbowTurnProps) {
  const rawId = useId();
  const fid = rawId.replace(/[^a-zA-Z0-9-]/g, "");

  const [reduced, setReduced] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [enterState, setEnterState] = useState<Record<string, "start" | "end">>({});
  const [exitingIds, setExitingIds] = useState<Record<string, true>>({});
  const [snap, setSnap] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pathElRef = useRef<SVGPathElement | null>(null);
  const dotElsRef = useRef<Map<string, SVGCircleElement>>(new Map());
  const dotWrapElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const posRef = useRef<Map<string, Pt>>(new Map());
  const prevCompactionIdsRef = useRef<Set<string>>(new Set());
  const cleanupsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => {
    for (const cancel of cleanupsRef.current) cancel();
    cleanupsRef.current = [];
  }, []);

  const { turns: turnTargets, lakes: lakeRows } = useMemo(() => layout(items), [items]);
  const H = Math.max(PAD_Y * 2, PAD_Y * 2 + Math.max(0, items.length - 1) * ROW_H);

  const [initialD] = useState(() => smoothPath(layout(items).turns.map((t) => ({ x: t.x, y: t.y }))));

  // channel + turn-dot animation: direct DOM writes, no React state on the hot path
  useEffect(() => {
    const targetMap = new Map(turnTargets.map((t) => [t.id, { x: t.x, y: t.y }]));
    for (const id of Array.from(posRef.current.keys())) {
      if (!targetMap.has(id)) posRef.current.delete(id);
    }

    if (reduced) {
      for (const t of turnTargets) {
        posRef.current.set(t.id, { x: t.x, y: t.y });
        const el = dotElsRef.current.get(t.id);
        el?.setAttribute("cx", String(t.x));
        el?.setAttribute("cy", String(t.y));
        const wrapEl = dotWrapElsRef.current.get(t.id);
        if (wrapEl) {
          wrapEl.style.left = `${t.x}px`;
          wrapEl.style.top = `${t.y}px`;
        }
      }
      pathElRef.current?.setAttribute("d", smoothPath(turnTargets.map((t) => ({ x: t.x, y: t.y }))));
      return;
    }

    let raf = 0;
    const step = () => {
      let moving = false;
      const pts: Pt[] = [];
      for (const t of turnTargets) {
        const cur = posRef.current.get(t.id) ?? { x: t.x, y: t.y };
        const nx = cur.x + (t.x - cur.x) * EASE_RATE;
        const ny = cur.y + (t.y - cur.y) * EASE_RATE;
        if (Math.abs(t.x - nx) > SETTLE_EPS || Math.abs(t.y - ny) > SETTLE_EPS) moving = true;
        posRef.current.set(t.id, { x: nx, y: ny });
        pts.push({ x: nx, y: ny });
        const el = dotElsRef.current.get(t.id);
        el?.setAttribute("cx", String(nx));
        el?.setAttribute("cy", String(ny));
        const wrapEl = dotWrapElsRef.current.get(t.id);
        if (wrapEl) {
          wrapEl.style.left = `${nx}px`;
          wrapEl.style.top = `${ny}px`;
        }
      }
      pathElRef.current?.setAttribute("d", smoothPath(pts));
      if (moving) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [turnTargets, reduced]);

  // compaction enter + aria-live announcements
  useEffect(() => {
    const curIds = new Set(lakeRows.map((l) => l.id));
    const prevIds = prevCompactionIdsRef.current;
    const added = lakeRows.filter((l) => !prevIds.has(l.id));
    const removedCount = Array.from(prevIds).filter((id) => !curIds.has(id)).length;

    if (added.length > 0) {
      if (!reduced) {
        setEnterState((s) => {
          const next = { ...s };
          for (const l of added) next[l.id] = "start";
          return next;
        });
        const raf1 = requestAnimationFrame(() => {
          const raf2 = requestAnimationFrame(() => {
            setEnterState((s) => {
              const next = { ...s };
              for (const l of added) if (next[l.id] === "start") next[l.id] = "end";
              return next;
            });
          });
          cleanupsRef.current.push(() => cancelAnimationFrame(raf2));
        });
        cleanupsRef.current.push(() => cancelAnimationFrame(raf1));
      }
      const first = added[0];
      setLiveMsg(
        `Compacted ${turnsLabel(first.item.turns)} into a ${formatTok(first.item.tokenCount)}-token summary.`
      );
      if (!reduced) {
        setSnap(true);
        const t = window.setTimeout(() => setSnap(false), 320);
        cleanupsRef.current.push(() => window.clearTimeout(t));
      }
    } else if (removedCount > 0 && added.length === 0) {
      // a removal this component didn't itself animate (e.g. reset) — still announce
      setLiveMsg("Re-injected turns back into live context.");
    }
    prevCompactionIdsRef.current = curIds;
  }, [lakeRows, reduced]);

  // outside click closes the open popover
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (triggerRefs.current.get(openId)?.contains(target)) return;
      setOpenId(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openId]);

  // focus the summary when a popover opens
  useEffect(() => {
    if (!openId) return;
    const raf = requestAnimationFrame(() => {
      popRef.current?.querySelector<HTMLElement>("[data-oxbow-summary]")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [openId]);

  const closeAndReturnFocus = (id: string) => {
    setOpenId(null);
    triggerRefs.current.get(id)?.focus({ preventScroll: true });
  };

  const handleReinject = (l: LakeRow) => {
    if (reduced) {
      setOpenId(null);
      onReinject?.(l.id);
      return;
    }
    setOpenId(null);
    setExitingIds((s) => ({ ...s, [l.id]: true }));
    const t = window.setTimeout(() => {
      onReinject?.(l.id);
      setExitingIds((s) => {
        const next = { ...s };
        delete next[l.id];
        return next;
      });
    }, 260);
    cleanupsRef.current.push(() => window.clearTimeout(t));
  };

  const onTriggerKeyDown = (l: LakeRow) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" && openId !== l.id) {
      e.preventDefault();
      setOpenId(l.id);
    }
  };

  const onMenuKeyDown = (l: LakeRow) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndReturnFocus(l.id);
      return;
    }
    if (e.key === "Tab") {
      setOpenId(null);
      return;
    }
    const items_ = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (items_.length === 0) return;
    const idx = items_.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (idx + 1) % items_.length;
    else if (e.key === "ArrowUp") next = idx < 0 ? items_.length - 1 : (idx - 1 + items_.length) % items_.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items_.length - 1;
    if (next >= 0) {
      e.preventDefault();
      items_[next]?.focus({ preventScroll: true });
    }
  };

  const turnCount = turnTargets.length;

  return (
    <div ref={wrapRef} role="group" aria-label={ariaLabel} className={`ns-oxbow relative ${className}`}>
      <style>{`
.ns-oxbow-dot{animation:ns-oxbow-dot-in 220ms cubic-bezier(.22,1,.36,1)}
.ns-oxbow-dot-current{fill:var(--foreground);animation:ns-oxbow-dot-in 220ms cubic-bezier(.22,1,.36,1),ns-oxbow-breathe 2.6s ease-in-out infinite}
.ns-oxbow-channel{transition:none}
.ns-oxbow-channel.ns-oxbow-snap{animation:ns-oxbow-snap 320ms cubic-bezier(.22,1,.36,1)}
.ns-oxbow-lake-anim,.ns-oxbow-chip-wrap{transition:transform 300ms cubic-bezier(.16,1,.3,1),opacity 220ms ease-out}
.ns-oxbow-lake-anim[data-state="entering"],.ns-oxbow-chip-wrap[data-state="entering"]{transform:translateX(0);opacity:0}
.ns-oxbow-lake-anim[data-state="settled"],.ns-oxbow-chip-wrap[data-state="settled"]{transform:translateX(${OFFSET}px);opacity:1}
.ns-oxbow-lake-anim[data-state="exiting"],.ns-oxbow-chip-wrap[data-state="exiting"]{transform:translateX(0);opacity:0;transition:transform 240ms cubic-bezier(.4,0,.9,.4),opacity 200ms ease-in}
.ns-oxbow-chip-tip,.ns-context-compaction-river-tip{opacity:0;transition:opacity 150ms ease-out}
[data-oxbow-trigger]:hover+.ns-oxbow-chip-tip,[data-oxbow-trigger]:focus+.ns-oxbow-chip-tip,[data-oxbow-trigger]:focus-visible+.ns-oxbow-chip-tip{opacity:1}
[data-context-compaction-river-btn]:hover+.ns-context-compaction-river-tip,[data-context-compaction-river-btn]:focus+.ns-context-compaction-river-tip,[data-context-compaction-river-btn]:focus-visible+.ns-context-compaction-river-tip{opacity:1}
@keyframes ns-oxbow-dot-in{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
@keyframes ns-oxbow-breathe{0%,100%{opacity:.75}50%{opacity:1}}
@keyframes ns-oxbow-snap{0%{stroke-width:1.5}35%{stroke-width:2.6}100%{stroke-width:1.5}}
@media (prefers-reduced-motion: reduce){
  .ns-oxbow-dot,.ns-oxbow-dot-current{animation:none !important;opacity:1 !important;transform:none !important}
  .ns-oxbow-channel{animation:none !important}
  .ns-oxbow-lake-anim,.ns-oxbow-chip-wrap{transition:opacity 160ms ease-out !important;transform:translateX(${OFFSET}px) !important}
  .ns-oxbow-lake-anim[data-state="entering"],.ns-oxbow-chip-wrap[data-state="entering"]{opacity:0 !important}
  .ns-oxbow-lake-anim[data-state="exiting"],.ns-oxbow-chip-wrap[data-state="exiting"]{opacity:0 !important}
  .ns-oxbow-chip-tip,.ns-context-compaction-river-tip{transition:none !important}
}
`}</style>

      <div className="relative" style={{ width: RAIL_W, height: H }}>
        <svg
          aria-hidden
          width={RAIL_W}
          height={H}
          viewBox={`0 0 ${RAIL_W} ${H}`}
          className="pointer-events-none absolute inset-0 block overflow-visible"
        >
          <path
            ref={pathElRef}
            d={initialD}
            className={`ns-oxbow-channel${snap ? " ns-oxbow-snap" : ""}`}
            fill="none"
            stroke="var(--ns-muted)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          {lakeRows.map((l) => {
            const state = exitingIds[l.id] ? "exiting" : enterState[l.id] === "start" ? "entering" : "settled";
            return (
              <g key={l.id} transform={`translate(${l.x} ${l.y})`}>
                {/* animated as one rigid unit: at rest (translateX 12) this spans exactly
                    anchor -> ellipse edge; the stub's own local span is kept constant so
                    sliding the group is what "grows the neck into place" looks like */}
                <g className="ns-oxbow-lake-anim" data-state={state}>
                  <path
                    d={`M ${-OFFSET} 0 Q ${-OFFSET * 0.5} -6 0 0`}
                    fill="none"
                    stroke="var(--ns-muted)"
                    strokeWidth={1}
                    strokeOpacity={0.55}
                  />
                  <ellipse
                    cx={15}
                    cy={0}
                    rx={15}
                    ry={9}
                    fill="color-mix(in srgb, var(--border) 6%, transparent)"
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                </g>
              </g>
            );
          })}

          {turnTargets.map((t) => (
            <circle
              key={t.id}
              ref={(el) => {
                if (el) {
                  dotElsRef.current.set(t.id, el);
                  if (!posRef.current.has(t.id)) {
                    el.setAttribute("cx", String(t.x));
                    el.setAttribute("cy", String(t.y));
                    posRef.current.set(t.id, { x: t.x, y: t.y });
                  }
                } else {
                  dotElsRef.current.delete(t.id);
                }
              }}
              r={t.isLast ? DOT_R + 1 : DOT_R}
              className={t.isLast ? "ns-oxbow-dot-current" : "ns-oxbow-dot"}
              fill={t.isLast ? undefined : "var(--ns-muted)"}
            >
              <title>{t.preview ? `${t.label}: ${t.preview}` : t.label}</title>
            </circle>
          ))}
        </svg>

        {/* real interactive targets for the (decorative, aria-hidden) turn dots above:
            positioned by the same rAF loop that drives the SVG circles (dotWrapElsRef),
            so the hit target and its tooltip track the easing motion instead of a
            React-controlled left/top that would snap ahead of the circle it sits on */}
        {turnTargets.map((t) => {
          const turnTipId = `${fid}-turn-tip-${t.id}`;
          const hasPreview = Boolean(t.preview);
          const accName = hasPreview ? `Turn ${t.label}: ${t.preview}` : `Turn ${t.label}`;
          return (
            <div
              key={t.id}
              ref={(el) => {
                if (el) {
                  dotWrapElsRef.current.set(t.id, el);
                  const cur = posRef.current.get(t.id) ?? { x: t.x, y: t.y };
                  el.style.left = `${cur.x}px`;
                  el.style.top = `${cur.y}px`;
                } else {
                  dotWrapElsRef.current.delete(t.id);
                }
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <button
                type="button"
                data-context-compaction-river-btn
                aria-label={accName}
                aria-describedby={hasPreview ? turnTipId : undefined}
                className="block h-4 w-4 cursor-default rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              />
              {hasPreview && (
                <span
                  id={turnTipId}
                  role="tooltip"
                  className="ns-context-compaction-river-tip pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-20 block w-max max-w-[200px] -translate-y-1/2 whitespace-normal rounded-md border border-border px-2 py-1 font-mono text-[10px] leading-relaxed text-foreground shadow-lg"
                  style={{ background: "color-mix(in srgb, var(--foreground) 4%, var(--background))" }}
                >
                  Turn {t.label}: {t.preview}
                </span>
              )}
            </div>
          );
        })}

        {lakeRows.map((l) => {
          const state = exitingIds[l.id] ? "exiting" : enterState[l.id] === "start" ? "entering" : "settled";
          const isOpen = openId === l.id;
          const menuId = `${fid}-menu-${l.id}`;
          const tipId = `${fid}-tip-${l.id}`;
          return (
            <div
              key={l.id}
              className="ns-oxbow-chip-wrap absolute"
              data-state={state}
              style={{ left: l.x, top: l.y - 12 }}
            >
              <button
                ref={(el) => {
                  if (el) triggerRefs.current.set(l.id, el);
                  else triggerRefs.current.delete(l.id);
                }}
                type="button"
                data-oxbow-trigger
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls={isOpen ? menuId : undefined}
                aria-describedby={!isOpen ? tipId : undefined}
                aria-label={`Compacted ${turnsLabel(l.item.turns)}, ${formatTok(l.item.tokenCount)} tokens. Open summary and re-inject.`}
                onClick={() => setOpenId(l.id)}
                onKeyDown={onTriggerKeyDown(l)}
                className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-wide text-ns-muted transition-colors duration-150 hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                style={{ background: "color-mix(in srgb, var(--foreground) 4%, var(--background))" }}
              >
                <span aria-hidden>{l.item.turns.length}↩</span>
                <span aria-hidden>{formatTok(l.item.tokenCount)} tok</span>
              </button>

              {!isOpen && (
                <span
                  id={tipId}
                  role="tooltip"
                  className="ns-oxbow-chip-tip pointer-events-none absolute bottom-[calc(100%+8px)] left-0 z-20 block w-max max-w-[220px] whitespace-normal rounded-md border border-border px-2 py-1 font-mono text-[10px] leading-relaxed text-foreground shadow-lg"
                  style={{ background: "color-mix(in srgb, var(--foreground) 4%, var(--background))" }}
                >
                  {turnsLabel(l.item.turns)} pinched off the channel · re-injectable
                </span>
              )}

              {isOpen && (
                <div
                  ref={popRef}
                  id={menuId}
                  className="absolute left-0 top-[calc(100%+8px)] z-10 w-60 rounded-md border border-border p-3 shadow-lg"
                  style={{ background: "color-mix(in srgb, var(--foreground) 3%, var(--background))" }}
                >
                  <p
                    data-oxbow-summary
                    tabIndex={-1}
                    className="text-xs leading-relaxed text-foreground outline-none"
                  >
                    {l.item.summary}
                  </p>
                  <dl className="mt-2.5 space-y-1 font-mono text-[10px] uppercase tracking-wide text-ns-muted">
                    <div className="flex justify-between gap-2">
                      <dt>Turns</dt>
                      <dd className="text-foreground">{turnsLabel(l.item.turns)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Summarized</dt>
                      <dd className="text-foreground">{l.item.compactedAgo}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Tokens</dt>
                      <dd className="text-foreground">{formatTok(l.item.tokenCount)}</dd>
                    </div>
                  </dl>
                  <div
                    role="menu"
                    aria-label={`Actions for compacted ${turnsLabel(l.item.turns)}`}
                    onKeyDown={onMenuKeyDown(l)}
                    className="mt-3 border-t border-border pt-2.5"
                  >
                    <button
                      role="menuitem"
                      type="button"
                      data-oxbow-reinject
                      onClick={() => handleReinject(l)}
                      className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent"
                    >
                      Re-inject into live context
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ul className="mt-3 space-y-1 font-mono text-[11px] leading-relaxed text-ns-muted">
        <li>
          Live context, {turnCount} turn{turnCount === 1 ? "" : "s"}
        </li>
        {lakeRows.map((l) => (
          <li key={l.id}>
            Compacted: {turnsLabel(l.item.turns)}, summarized {l.item.compactedAgo}
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="sr-only">
        {liveMsg}
      </p>
    </div>
  );
}
