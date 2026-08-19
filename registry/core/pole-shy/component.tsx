"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PoleShy — live cursor name-labels that behave as like-pole magnets. Every
// label carries the same polarity, so labels crowding one line shove each
// other apart along the baseline with inverse-square falloff, and whoever is
// actively typing carries a stronger field, so bystander labels yield and
// drift back. Dominance is expressed by who moves out of whose way, never by
// size, glow or color — the currently-typing label is styled identically to
// every other label.
//
// MECHANISM: users are grouped into "bands" by their integer `row` — only
// labels sharing a row ever interact, matching how carets on different lines
// of a real document never fight for the same space. Within a crowded band
// (>=2 members), a 30fps-throttled loop computes each user's field strength
// F = BASE * (1 + 2 * exp(-idleMs / DECAY_MS)) — 3x base the instant `typing`
// is true, decaying back to 1x base over ~1.4s of not typing, so dominance
// fades rather than snapping off. Every pair in the band repels with
// Fi*Fj/d^2 along the horizontal axis only; that repulsion is summed as an
// external force into a critically-damped spring pulling each label back
// toward its true anchor (offset 0), clamped to +/-48px, and written directly
// to a ref'd DOM node's transform each tick — refs-only, no per-frame
// setState. A hairline SVG leader always connects the label's current
// (possibly displaced) position to its true caret position, so the anchor is
// never ambiguous even when a label has moved.
//
// prefers-reduced-motion drops the spring entirely: crowded-band members
// render with zero horizontal displacement and instead stack vertically,
// each still leadered straight down to its own true caret. No physics loop
// runs at all in that mode.
// ---------------------------------------------------------------------------

export interface PoleShyUser {
  id: string;
  name: string;
  /** normalized 0..1 horizontal position of this user's true caret within the band */
  x: number;
  /** integer line/row index — the caret's true vertical band. Only users sharing a row repel each other. */
  row: number;
  /** true while this user is actively producing keystrokes right now */
  typing: boolean;
  /** optional human label of where they are, used only in the "is typing in ___" announcement */
  section?: string;
}

export interface PoleShyProps {
  users: PoleShyUser[];
  className?: string;
}

const ROW_HEIGHT = 64;
const LABEL_TOP_IN_ROW = 4;
const LABEL_H = 26;
const CARET_BOTTOM_GAP = 14;
const STACK_GAP = 32;

const MAX_OFFSET = 72;
const DECAY_MS = 1400;
const BASE_FIELD = 1;
const TYPING_MULT = 3;
// Hovering a label is this component's own way of asking "let me read that
// one" — it feeds the same field-strength mechanism typing does (so the
// separation is real physics, not a tooltip layer), decaying back on the
// same curve once the pointer leaves so it settles rather than snapping.
const HOVER_MULT = 5;
const SPRING_K = 46; // s^-2
const SPRING_ZETA = 0.85;
// Chosen so two idle (F=1) labels ~50px apart settle a few px off anchor,
// and a typing/hovered (F=3x) neighbour pushes that toward the clamp: at
// equilibrium offset ~= REPULSE_K * Fi*Fj / (SPRING_K * d^2). Raised
// alongside MAX_OFFSET so a crowded band of 4 long names can actually clear
// each other at full field strength instead of clamping short of it.
const REPULSE_K = 2_000_000;
const MIN_D = 24; // px, floor on pairwise distance so near-overlap can't slam the clamp in one tick
const MAX_VEL = 900; // px/s
const TICK_MS = 1000 / 30; // 30fps throttle

interface LabelPhysics {
  offset: number;
  vel: number;
}

interface BandInfo {
  size: number;
  stackIndex: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PoleShy({ users, className = "" }: PoleShyProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [announcement, setAnnouncement] = useState("");
  // Which label is currently under the pointer — the only thing this drives
  // is field strength (below) and paint order (so the revealed label draws
  // over its neighbours instead of losing a coin-flip on DOM order).
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(0);
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const leaderRefs = useRef<Map<string, SVGLineElement>>(new Map());
  const physicsRef = useRef<Map<string, LabelPhysics>>(new Map());
  const lastTypingAtRef = useRef<Map<string, number>>(new Map());
  const lastHoverAtRef = useRef<Map<string, number>>(new Map());
  const hoveredIdRef = useRef<string | null>(null);
  hoveredIdRef.current = hoveredId;
  const usersRef = useRef<PoleShyUser[]>(users);
  usersRef.current = users;

  const prevAnnounceRef = useRef<Map<string, { name: string; typing: boolean }> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      widthRef.current = box.width;
      setSize((prev) =>
        prev.width === box.width && prev.height === box.height
          ? prev
          : { width: box.width, height: box.height }
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxRow = useMemo(() => users.reduce((m, u) => Math.max(m, u.row), 0), [users]);

  // Per-user band membership: how many users share its row, and (for the
  // reduced-motion stacked layout only) its order within that band.
  const bandInfo = useMemo(() => {
    const byRow = new Map<number, PoleShyUser[]>();
    for (const u of users) {
      const arr = byRow.get(u.row) ?? [];
      arr.push(u);
      byRow.set(u.row, arr);
    }
    const info = new Map<string, BandInfo>();
    for (const members of byRow.values()) {
      const sorted = [...members].sort((a, b) => a.x - b.x);
      sorted.forEach((u, i) => info.set(u.id, { size: members.length, stackIndex: i }));
    }
    return info;
  }, [users]);

  // Row geometry. Under reduced motion a crowded row grows tall enough to
  // hold its vertical stack instead of the labels ever moving horizontally;
  // every other row (and every row when motion is allowed) stays a fixed
  // ROW_HEIGHT since the physics displacement never leaves that band.
  const rowLayout = useMemo(() => {
    const bandSizeByRow = new Map<number, number>();
    for (const u of users) bandSizeByRow.set(u.row, (bandSizeByRow.get(u.row) ?? 0) + 1);
    const rowCount = maxRow + 1;
    const tops: number[] = [];
    const heights: number[] = [];
    let acc = 0;
    for (let r = 0; r < rowCount; r++) {
      const bandSize = bandSizeByRow.get(r) ?? 0;
      const h =
        reducedMotion && bandSize >= 2
          ? Math.max(ROW_HEIGHT, LABEL_TOP_IN_ROW + bandSize * STACK_GAP + LABEL_H)
          : ROW_HEIGHT;
      tops.push(acc);
      heights.push(h);
      acc += h;
    }
    return { tops, heights, total: acc || ROW_HEIGHT };
  }, [users, maxRow, reducedMotion]);

  function rowTop(row: number) {
    return rowLayout.tops[row] ?? 0;
  }
  function rowCaretY(row: number) {
    return rowTop(row) + (rowLayout.heights[row] ?? ROW_HEIGHT) - CARET_BOTTOM_GAP;
  }

  // Prune stale physics/decay state for users who have left, so a long-lived
  // session with churn doesn't grow these maps forever.
  useEffect(() => {
    const ids = new Set(users.map((u) => u.id));
    for (const id of physicsRef.current.keys()) {
      if (!ids.has(id)) physicsRef.current.delete(id);
    }
    for (const id of lastTypingAtRef.current.keys()) {
      if (!ids.has(id)) lastTypingAtRef.current.delete(id);
    }
    for (const id of lastHoverAtRef.current.keys()) {
      if (!ids.has(id)) lastHoverAtRef.current.delete(id);
    }
    setHoveredId((h) => (h && !ids.has(h) ? null : h));
  }, [users]);

  // ---- physics loop (skipped entirely under reduced motion) --------------
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last = 0;
    let running = true;

    const cAnchor = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);

    function integrate(st: LabelPhysics, extraAccel: number, dt: number) {
      const accel = -SPRING_K * st.offset - cAnchor * st.vel + extraAccel;
      st.vel += accel * dt;
      if (st.vel > MAX_VEL) st.vel = MAX_VEL;
      else if (st.vel < -MAX_VEL) st.vel = -MAX_VEL;
      st.offset += st.vel * dt;
      if (st.offset > MAX_OFFSET) {
        st.offset = MAX_OFFSET;
        if (st.vel > 0) st.vel = 0;
      } else if (st.offset < -MAX_OFFSET) {
        st.offset = -MAX_OFFSET;
        if (st.vel < 0) st.vel = 0;
      }
    }

    function apply(id: string, offset: number, trueX: number) {
      const label = labelRefs.current.get(id);
      if (label) label.style.transform = `translateX(calc(-50% + ${offset.toFixed(2)}px))`;
      const leader = leaderRefs.current.get(id);
      if (leader) leader.setAttribute("x1", (trueX + offset).toFixed(2));
    }

    function step(now: number, dt: number) {
      const width = widthRef.current;
      if (!width) return;

      const byRow = new Map<number, PoleShyUser[]>();
      for (const u of usersRef.current) {
        const arr = byRow.get(u.row) ?? [];
        arr.push(u);
        byRow.set(u.row, arr);
      }

      for (const members of byRow.values()) {
        if (members.length < 2) {
          // Not (or no longer) crowded — relax any residual offset back to
          // its true anchor, spring only, no repulsion.
          for (const u of members) {
            const st = physicsRef.current.get(u.id);
            if (!st) continue;
            if (st.offset === 0 && st.vel === 0) continue;
            integrate(st, 0, dt);
            apply(u.id, st.offset, u.x * width);
          }
          continue;
        }

        // Field strength per member: 3x base the instant `typing` is true,
        // decaying back toward 1x base over DECAY_MS of not typing. Hovering
        // a label drives the same field through its own independent decay,
        // so "let me read that one" uses the identical repulsion mechanism
        // as "I'm typing here" rather than a second, unrelated affordance.
        const field = new Map<string, number>();
        const hovered = hoveredIdRef.current;
        for (const u of members) {
          const lastTyping = lastTypingAtRef.current.get(u.id) ?? -Infinity;
          if (u.typing) lastTypingAtRef.current.set(u.id, now);
          const typingIdle = u.typing ? 0 : now - lastTyping;
          const typingMult = 1 + (TYPING_MULT - 1) * Math.exp(-typingIdle / DECAY_MS);

          const isHovered = u.id === hovered;
          const lastHover = lastHoverAtRef.current.get(u.id) ?? -Infinity;
          if (isHovered) lastHoverAtRef.current.set(u.id, now);
          const hoverIdle = isHovered ? 0 : now - lastHover;
          const hoverMult = 1 + (HOVER_MULT - 1) * Math.exp(-hoverIdle / DECAY_MS);

          field.set(u.id, BASE_FIELD * Math.max(typingMult, hoverMult));
        }

        for (const u of members) {
          let st = physicsRef.current.get(u.id);
          if (!st) {
            st = { offset: 0, vel: 0 };
            physicsRef.current.set(u.id, st);
          }
          const xi = u.x * width + st.offset;
          let repel = 0;
          for (const v of members) {
            if (v.id === u.id) continue;
            const vst = physicsRef.current.get(v.id) ?? { offset: 0, vel: 0 };
            const xj = v.x * width + vst.offset;
            const raw = xi - xj;
            const d = Math.max(Math.abs(raw), MIN_D);
            const dir = raw === 0 ? (u.id < v.id ? 1 : -1) : Math.sign(raw);
            repel += (dir * REPULSE_K * field.get(u.id)! * field.get(v.id)!) / (d * d);
          }
          integrate(st, repel, dt);
          apply(u.id, st.offset, u.x * width);
        }
      }
    }

    function frame(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      if (last === 0) {
        last = now;
        return;
      }
      if (now - last < TICK_MS) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      step(now, dt);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  // ---- live-region announcements: state changes only, never motion -------
  useEffect(() => {
    const prev = prevAnnounceRef.current;
    const isFirst = prev === null;
    let msg = "";

    if (!isFirst) {
      const currentIds = new Set(users.map((u) => u.id));
      for (const [id, was] of prev) {
        if (!currentIds.has(id)) msg = `${was.name} left`;
      }
      for (const u of users) {
        const before = prev.get(u.id);
        if (!before) {
          msg = `${u.name} joined`;
          continue;
        }
        if (!before.typing && u.typing) {
          msg = u.section ? `${u.name} is typing in ${u.section}` : `${u.name} is typing`;
        }
      }
    }

    prevAnnounceRef.current = new Map(users.map((u) => [u.id, { name: u.name, typing: u.typing }]));
    if (!isFirst && msg) setAnnouncement(msg);
  }, [users]);

  return (
    <div
      ref={containerRef}
      className={["relative w-full overflow-hidden", className].join(" ")}
      style={{ height: rowLayout.total }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {users.map((u) => {
          const trueX = u.x * size.width;
          const caretY = rowCaretY(u.row);
          const info = bandInfo.get(u.id);
          const stacked = reducedMotion && info && info.size >= 2;
          const labelTopY = stacked
            ? rowTop(u.row) + LABEL_TOP_IN_ROW + info!.stackIndex * STACK_GAP
            : rowTop(u.row) + LABEL_TOP_IN_ROW;
          const labelBottomY = labelTopY + LABEL_H;
          return (
            <g key={u.id}>
              <line
                ref={(el) => {
                  if (el) leaderRefs.current.set(u.id, el);
                  else leaderRefs.current.delete(u.id);
                }}
                x1={trueX}
                y1={labelBottomY}
                x2={trueX}
                y2={caretY}
                stroke="var(--border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={trueX} cy={caretY} r={3} fill="var(--foreground)" opacity={0.55} />
            </g>
          );
        })}
      </svg>

      {users.map((u) => {
        const info = bandInfo.get(u.id);
        const stacked = reducedMotion && info && info.size >= 2;
        const top = stacked
          ? rowTop(u.row) + LABEL_TOP_IN_ROW + info!.stackIndex * STACK_GAP
          : rowTop(u.row) + LABEL_TOP_IN_ROW;
        const isHovered = u.id === hoveredId;
        return (
          <div
            key={u.id}
            ref={(el) => {
              if (el) labelRefs.current.set(u.id, el);
              else labelRefs.current.delete(u.id);
            }}
            className="absolute flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 shadow-sm"
            onMouseEnter={() => setHoveredId(u.id)}
            onMouseLeave={() => setHoveredId((h) => (h === u.id ? null : h))}
            style={{
              left: `${u.x * 100}%`,
              top,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              // Hovering is this component's own reveal mechanism (stronger
              // field -> neighbours yield further, see the physics loop
              // above) — pulling the hovered chip's paint order above its
              // crowded neighbours is the other half: without it the label
              // could still lose an arbitrary DOM-order coin-flip against
              // an un-hovered sibling sitting closer to its own anchor.
              zIndex: isHovered ? 10 : 1,
            }}
          >
            <span className="rounded-full border border-border px-1 font-mono text-[9px] leading-[14px] text-ns-muted">
              {initials(u.name)}
            </span>
            <span className="text-xs text-foreground">{u.name}</span>
          </div>
        );
      })}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
