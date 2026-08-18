"use client";

import { useCallback, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RaftMoor — a thin presence rail down the document's edge. Each
// collaborator is a 20px initialed chip whose y is their live scroll
// fraction through the document, set directly (no easing curve on the
// mapping itself). When two or more chips land within CLUSTER_GAP of each
// other they "raft up": the earliest-arrived stays flush to the rail, every
// later arrival moors one chip-width further out, so co-location is legible
// instead of collapsing into a "+n" count. Motion between targets is a
// per-chip critically-damped spring (settles well under 400ms) integrated
// in one rAF loop that sleeps once every chip is at rest; a separate 1.5s
// interval (independent of the spring) tracks per-collaborator idle time and
// eases opacity to 0.5 past the threshold, since a "have they moved
// recently" check has nothing to do with spatial motion. DOM+SVG-free —
// plain absolutely-positioned buttons, transforms written by ref, no React
// state on the hot path. Colors are token classes only; --ns-accent never
// touches a resting chip, only the hover/focus state of the jump button.
// ---------------------------------------------------------------------------

export interface RaftMoorCollaborator {
  /** stable identity — used for React keys, DOM refs and raft bookkeeping */
  id: string;
  /** full name, used in the accessible name */
  name: string;
  /** 1–2 chars shown in the chip; derived from `name` when omitted */
  initials?: string;
  /** 0..1 — fraction through the document. The governing scalar: sets tag y directly. */
  fraction: number;
  /** id of the heading/section element this collaborator is nearest to */
  sectionId: string;
  /** human label for that section, used in the accessible name */
  sectionLabel: string;
}

const CHIP = 20; // px — chip is 20×20, radius-6
const GAP = 6; // px between raft slots
const SLOT = CHIP + GAP;
const CLUSTER_GAP = 24; // px — chips within this vertical distance raft together
const STIFFNESS = 260; // px/s² per px of error
const DAMPING = 30; // just under critical — settles well inside 400ms, no overshoot to speak of
const IDLE_POLL_MS = 1500;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function initialsOf(c: RaftMoorCollaborator) {
  if (c.initials) return c.initials.slice(0, 2).toUpperCase();
  return c.name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function labelFor(c: RaftMoorCollaborator) {
  const pct = Math.round(clamp01(c.fraction) * 100);
  return `Jump to ${c.name}, ${pct}% through, section ${c.sectionLabel}`;
}

export function RaftMoor({
  collaborators,
  /** ms of no fraction/section change before a chip eases to 50% opacity */
  idleThresholdMs = 60000,
  /** rail height as a fraction of viewport height */
  railHeightVh = 70,
  className = "",
}: {
  collaborators: RaftMoorCollaborator[];
  idleThresholdMs?: number;
  railHeightVh?: number;
  className?: string;
}) {
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const collabRef = useRef(collaborators);
  const reducedRef = useRef(false);
  const apiRef = useRef<{ recompute: () => void; idleTick: () => void } | null>(null);

  useEffect(() => {
    collabRef.current = collaborators;
    apiRef.current?.recompute();
    apiRef.current?.idleTick();
  }, [collaborators]);

  const jump = useCallback((c: RaftMoorCollaborator) => {
    const target = document.getElementById(c.sectionId);
    if (!target) return;
    const reduced = reducedRef.current;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const focusTarget = () => {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    // let the smooth scroll actually land before yanking focus into view
    if (reduced) focusTarget();
    else window.setTimeout(focusTarget, 450);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;

    let H = window.innerHeight * (railHeightVh / 100);

    type Phys = { x: number; y: number; vx: number; vy: number };
    const phys = new Map<string, Phys>();
    // per-id: the timestamp this id most recently joined its current raft,
    // and the set of raft-mates it joined with (used to tell "still rafted
    // with someone" apart from "just arrived at a new stretch")
    const arrival = new Map<string, { at: number; neighbors: Set<string> }>();
    const moved = new Map<string, { sig: string; at: number }>();
    const targetX = new Map<string, number>();
    const targetY = new Map<string, number>();

    let raf = 0;
    let last = 0;

    const prune = () => {
      const ids = new Set(collabRef.current.map((c) => c.id));
      for (const m of [phys, arrival, moved, targetX, targetY] as Map<string, unknown>[]) {
        for (const id of Array.from(m.keys())) if (!ids.has(id)) m.delete(id);
      }
      for (const id of Array.from(btnRefs.current.keys())) {
        if (!ids.has(id)) btnRefs.current.delete(id);
      }
    };

    // clusters chips within CLUSTER_GAP of each other and assigns each one a
    // raft slot by arrival order: the id that has been continuously rafted
    // (sharing at least one prior raft-mate) longest gets slot 0 (flush to
    // the rail); everyone newer to this particular raft moors further out.
    const layoutSlots = () => {
      const list = collabRef.current;
      list.forEach((c) => targetY.set(c.id, clamp01(c.fraction) * H));

      const order = [...list].sort((a, b) => (targetY.get(a.id) ?? 0) - (targetY.get(b.id) ?? 0));
      const clusters: RaftMoorCollaborator[][] = [];
      let cur: RaftMoorCollaborator[] = [];
      let prevY = -Infinity;
      for (const c of order) {
        const y = targetY.get(c.id) ?? 0;
        if (cur.length && y - prevY > CLUSTER_GAP) {
          clusters.push(cur);
          cur = [];
        }
        cur.push(c);
        prevY = y;
      }
      if (cur.length) clusters.push(cur);

      for (const cluster of clusters) {
        if (cluster.length === 1) {
          const id = cluster[0]?.id;
          if (id) {
            targetX.set(id, 0);
            arrival.delete(id); // solo now — a future raft here is a fresh arrival
          }
          continue;
        }
        const ids = new Set(cluster.map((c) => c.id));
        for (const c of cluster) {
          const others = new Set(ids);
          others.delete(c.id);
          const prev = arrival.get(c.id);
          let stillTogether = false;
          if (prev) {
            for (const id of prev.neighbors) {
              if (others.has(id)) {
                stillTogether = true;
                break;
              }
            }
          }
          arrival.set(c.id, {
            at: stillTogether && prev ? prev.at : performance.now(),
            neighbors: others,
          });
        }
        const ranked = [...cluster].sort((a, b) => {
          const ta = arrival.get(a.id)?.at ?? 0;
          const tb = arrival.get(b.id)?.at ?? 0;
          return ta !== tb ? ta - tb : a.id.localeCompare(b.id);
        });
        ranked.forEach((c, i) => targetX.set(c.id, i * SLOT));
      }
    };

    const springStep = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0.001), 1 / 30);
      last = now;
      let settled = true;
      for (const c of collabRef.current) {
        const p = phys.get(c.id);
        if (!p) continue;
        const tx = targetX.get(c.id) ?? p.x;
        const ty = targetY.get(c.id) ?? p.y;
        p.vx += (STIFFNESS * (tx - p.x) - DAMPING * p.vx) * dt;
        p.x += p.vx * dt;
        p.vy += (STIFFNESS * (ty - p.y) - DAMPING * p.vy) * dt;
        p.y += p.vy * dt;
        if (Math.abs(p.vx) > 0.4 || Math.abs(p.vy) > 0.4 || Math.abs(tx - p.x) > 0.25 || Math.abs(ty - p.y) > 0.25) {
          settled = false;
        }
        const btn = btnRefs.current.get(c.id);
        if (btn) btn.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      }
      raf = settled ? 0 : requestAnimationFrame(springStep);
    };
    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(springStep);
      }
    };

    const recompute = () => {
      prune();
      layoutSlots();
      const list = collabRef.current;

      // place any chip that has no physics state yet directly at its target
      // (first appearance never "flies in" from 0,0) and reveal it
      for (const c of list) {
        if (!phys.has(c.id)) {
          const x = targetX.get(c.id) ?? 0;
          const y = targetY.get(c.id) ?? 0;
          phys.set(c.id, { x, y, vx: 0, vy: 0 });
          const btn = btnRefs.current.get(c.id);
          if (btn) {
            btn.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            btn.style.opacity = "1";
          }
        }
      }

      if (reducedRef.current) {
        for (const c of list) {
          const p = phys.get(c.id);
          if (!p) continue;
          p.x = targetX.get(c.id) ?? p.x;
          p.y = targetY.get(c.id) ?? p.y;
          p.vx = 0;
          p.vy = 0;
          const btn = btnRefs.current.get(c.id);
          if (btn) btn.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        }
      } else {
        wake();
      }
    };

    const idleTick = () => {
      const now = Date.now();
      for (const c of collabRef.current) {
        const sig = `${c.fraction.toFixed(4)}|${c.sectionId}`;
        const prev = moved.get(c.id);
        if (!prev || prev.sig !== sig) moved.set(c.id, { sig, at: now });
        const lastAt = moved.get(c.id)?.at ?? now;
        const idle = now - lastAt > idleThresholdMs;
        const btn = btnRefs.current.get(c.id);
        if (!btn) continue;
        btn.style.opacity = idle ? "0.5" : "1";
        const label = labelFor(c);
        if (btn.getAttribute("aria-label") !== label) btn.setAttribute("aria-label", label);
      }
    };

    apiRef.current = { recompute, idleTick };
    recompute();
    idleTick();

    const onResize = () => {
      H = window.innerHeight * (railHeightVh / 100);
      recompute();
    };
    const onReducedChange = () => {
      reducedRef.current = mq.matches;
      recompute();
    };
    window.addEventListener("resize", onResize);
    mq.addEventListener("change", onReducedChange);
    const interval = window.setInterval(idleTick, IDLE_POLL_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onReducedChange);
      apiRef.current = null;
    };
    // idleThresholdMs / railHeightVh changing mid-life is rare enough that a
    // remount (picking up the new value) is the right cost/complexity trade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleThresholdMs, railHeightVh]);

  return (
    <nav
      aria-label="Collaborators' positions in this document"
      className={`fixed left-4 top-1/2 z-40 -translate-y-1/2 ${className}`}
      style={{ height: `${railHeightVh}vh` }}
    >
      <div aria-hidden className="absolute left-0 top-0 h-full w-px bg-border" />
      <ul className="relative m-0 h-full list-none p-0">
        {collaborators.map((c) => (
          <li key={c.id} className="absolute left-0 top-0 m-0 p-0">
            <button
              type="button"
              ref={(el) => {
                if (el) btnRefs.current.set(c.id, el);
                else btnRefs.current.delete(c.id);
              }}
              onClick={() => jump(c)}
              aria-label={labelFor(c)}
              className="flex h-5 w-5 select-none items-center justify-center rounded-sm border border-border bg-background font-mono text-[9px] font-medium leading-none text-foreground opacity-0 transition-[opacity] duration-300 ease-out hover:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              <span aria-hidden>{initialsOf(c)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
