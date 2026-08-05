"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// MetaballMerge — group membership drawn as an IMPLICIT SURFACE. Every item is
// a charge in an inverse-square scalar field, F(x,y) = Σ rᵢ² / (dᵢ² + 1e-3),
// and the only thing ever painted is the marching-squares isoline at F = 1,
// stroked as a bare hairline. Nothing is filled, so the frame stays almost
// entirely empty and the SHAPE carries the whole message: charges close enough
// together share one necked contour, and an item that leaves visibly pinches
// off into its own closed loop. No legend, no caption, no colour code.
// ---------------------------------------------------------------------------

export interface MetaballItem {
  id: string;
  label: string;
  /** starts inside the group (default true) */
  member?: boolean;
}

export interface MetaballMergeProps {
  items?: MetaballItem[];
  /** names the group for assistive tech */
  label?: string;
  onChange?: (memberIds: string[]) => void;
  className?: string;
}

const DEFAULT_ITEMS: MetaballItem[] = [
  { id: "mara", label: "Mara Chen" },
  { id: "jonas", label: "Jonas Weber" },
  { id: "aiko", label: "Aiko Tanaka" },
  { id: "ravi", label: "Ravi Patel", member: false },
];

// --- field / isoline ------------------------------------------------------
const GRID = 4; // px lattice for marching squares
const ISO = 1.0; // threshold — a lone charge's contour is exactly its radius
const EPS = 1e-3; // softening, keeps F finite at a charge centre
const STROKE_W = 1.25;
const STROKE_A = 0.85;

// --- layout ---------------------------------------------------------------
const IN_F = 0.5; // member anchor, as a fraction of the cluster radius Rc
const OUT_F = 1.35; // non-member anchor — comfortably past the merge distance
const FIT = 0.47; // outermost anchor + its radius, as a fraction of min(w,h)
// Charge radius is derived from the member-to-member chord rather than picked
// by eye: two equal charges a chord S apart neck at half-width
// √(2r² − S²/4), so r = 0.4·S puts the waist at ~0.66r — thin enough to read
// as a genuine neck, thick enough that the ±6% ambient breathing never
// severs it. Member slots sit one ARC step apart, so that chord is constant.
const R_OF_CHORD = 0.4;
const HOVER_SWELL = 1.18;

// --- motion ---------------------------------------------------------------
const K = 120; // spring stiffness, s^-2
const ZETA = 1.0; // critically damped
const C = 2 * ZETA * Math.sqrt(K);
const ORBIT_R = 3; // px ambient orbit radius
const ORBIT_HZ = 0.11;
const BREATHE = 0.06; // ±6% radius
const BREATHE_HZ = 0.07;
const DT_MAX = 0.05;
const SETTLED = 0.02;
const TAU = Math.PI * 2;

// 16-case marching-squares segment table; corner bits are TL=1 TR=2 BR=4 BL=8
// and an edge index is 0=top 1=right 2=bottom 3=left. Cases 5 and 10 are the
// saddles and are resolved from the cell-centre sample instead.
const CASES: number[][] = [
  [],
  [3, 0],
  [0, 1],
  [3, 1],
  [1, 2],
  [],
  [0, 2],
  [3, 2],
  [2, 3],
  [2, 0],
  [],
  [2, 1],
  [1, 3],
  [1, 0],
  [0, 3],
  [],
];

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** shortest signed angle from a to b, in (-π, π] */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

type Charge = {
  id: string;
  home: number; // the item's own direction from the centroid
  slot: number; // the direction it is currently anchored along
  dist: number; // anchor distance as a fraction of Rc
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  phase: number;
  breathPhase: number;
  member: boolean;
  hover: boolean;
};

export function MetaballMerge({
  items = DEFAULT_ITEMS,
  label = "Group",
  onChange,
  className = "",
}: MetaballMergeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [members, setMembers] = useState<string[]>(() =>
    items.filter((it) => it.member !== false).map((it) => it.id)
  );
  const membersRef = useRef(members);
  membersRef.current = members;
  const engineRef = useRef<{
    sync: () => void;
    setHover: (index: number, on: boolean) => void;
  } | null>(null);

  useEffect(() => {
    engineRef.current?.sync();
  }, [members]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const n = items.length;
    // Member slots are one ARC_STEP apart on the inner circle. 2π/(n+2)
    // guarantees the arc still has a 3-step gap even with every item inside,
    // so the cluster is always an open chain and never closes into a ring
    // with a hole punched through the middle.
    const ARC_STEP = TAU / (n + 2);
    const CHORD = 2 * IN_F * Math.sin(ARC_STEP / 2); // in units of Rc
    const R_F = R_OF_CHORD * CHORD; // charge radius, in units of Rc

    const charges: Charge[] = items.map((it, i) => {
      const home = -Math.PI / 2 + (TAU * i) / Math.max(1, n);
      return {
        id: it.id,
        home,
        slot: home,
        dist: OUT_F,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 0,
        vr: 0,
        phase: hash01(it.id) * TAU,
        breathPhase: hash01(it.id + "~b") * TAU,
        member: false,
        hover: false,
      };
    });

    let ink = "currentColor";
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let rc = 0;
    let gw = 0;
    let gh = 0;
    let field = new Float32Array(0);
    let sized = false;
    let seeded = false;
    let raf = 0;
    let last = 0;
    let t = 0;

    const readInk = () => {
      ink = getComputedStyle(canvas).color;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        sized = false;
        return;
      }
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      // the outermost anchor plus its own radius has to stay inside the box
      rc = (FIT * Math.min(w, h)) / (OUT_F + R_F);
      gw = Math.floor(w / GRID) + 1;
      gh = Math.floor(h / GRID) + 1;
      if (field.length !== gw * gh) field = new Float32Array(gw * gh);
      sized = true;
    };

    // Membership decides BOTH the anchor distance and which slot the item
    // takes: members are packed onto consecutive slots of an arc centred on
    // their own mean direction, so every member is a neighbour of another
    // member and the group is always one connected contour — never two
    // "grouped" items sitting too far apart to merge. Non-members keep their
    // own direction and are pushed out to 1.35·Rc.
    const relayout = () => {
      const set = membersRef.current;
      for (const c of charges) c.member = set.includes(c.id);
      const mem = charges.filter((c) => c.member);
      for (const c of charges) {
        if (!c.member) {
          c.slot = c.home;
          c.dist = OUT_F;
        }
      }
      if (mem.length === 0) return;
      let sx = 0;
      let sy = 0;
      for (const c of mem) {
        sx += Math.cos(c.home);
        sy += Math.sin(c.home);
      }
      const mean =
        sx === 0 && sy === 0 ? charges[0]!.home : Math.atan2(sy, sx);
      // keep the members' original circular order so slots never cross
      mem.sort((a, b) => angleDelta(mean, a.home) - angleDelta(mean, b.home));
      const half = (mem.length - 1) / 2;
      mem.forEach((c, k) => {
        c.slot = mean + (k - half) * ARC_STEP;
        c.dist = IN_F;
      });
    };

    const targetOf = (c: Charge) => ({
      x: cx + Math.cos(c.slot) * c.dist * rc,
      y: cy + Math.sin(c.slot) * c.dist * rc,
      r: R_F * rc * (c.hover ? HOVER_SWELL : 1),
    });

    const seed = () => {
      for (const c of charges) {
        const tg = targetOf(c);
        c.x = tg.x;
        c.y = tg.y;
        c.r = tg.r;
        c.vx = c.vy = c.vr = 0;
      }
      seeded = true;
    };

    // integrate every spring one step; returns true while anything still moves
    const step = (dt: number) => {
      let moving = false;
      for (const c of charges) {
        const tg = targetOf(c);
        const ax = -K * (c.x - tg.x) - C * c.vx;
        const ay = -K * (c.y - tg.y) - C * c.vy;
        const ar = -K * (c.r - tg.r) - C * c.vr;
        c.vx += ax * dt;
        c.vy += ay * dt;
        c.vr += ar * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.r += c.vr * dt;
        if (
          Math.abs(c.x - tg.x) > SETTLED ||
          Math.abs(c.y - tg.y) > SETTLED ||
          Math.abs(c.r - tg.r) > SETTLED ||
          Math.abs(c.vx) > SETTLED ||
          Math.abs(c.vy) > SETTLED ||
          Math.abs(c.vr) > SETTLED
        ) {
          moving = true;
        }
      }
      return moving;
    };

    // resolved charge positions/radii for this frame, ambient pulse folded in
    const px = new Float64Array(n);
    const py = new Float64Array(n);
    const pr2 = new Float64Array(n);

    const resolve = (time: number) => {
      for (let i = 0; i < n; i++) {
        const c = charges[i]!;
        if (reduced) {
          px[i] = c.x;
          py[i] = c.y;
          pr2[i] = c.r * c.r;
          continue;
        }
        const a = TAU * ORBIT_HZ * time + c.phase;
        px[i] = c.x + Math.cos(a) * ORBIT_R;
        py[i] = c.y + Math.sin(a) * ORBIT_R;
        const br =
          c.r * (1 + BREATHE * Math.sin(TAU * BREATHE_HZ * time + c.breathPhase));
        pr2[i] = br * br;
      }
    };

    const fieldAt = (x: number, y: number) => {
      let f = 0;
      for (let i = 0; i < n; i++) {
        const dx = x - px[i]!;
        const dy = y - py[i]!;
        f += pr2[i]! / (dx * dx + dy * dy + EPS);
      }
      return f;
    };

    const render = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, w, h);

      for (let gy = 0; gy < gh; gy++) {
        const y = gy * GRID;
        const row = gy * gw;
        for (let gx = 0; gx < gw; gx++) {
          field[row + gx] = fieldAt(gx * GRID, y);
        }
      }

      const path = new Path2D();
      // linear interpolation along a cell edge — a midpoint placement here is
      // what makes a marching-squares contour look visibly stair-stepped
      const lerp = (fa: number, fb: number) => {
        const d = fb - fa;
        if (Math.abs(d) < 1e-9) return 0.5;
        const tx = (ISO - fa) / d;
        return tx < 0 ? 0 : tx > 1 ? 1 : tx;
      };

      for (let gy = 0; gy < gh - 1; gy++) {
        const r0 = gy * gw;
        const r1 = r0 + gw;
        const y0 = gy * GRID;
        const y1 = y0 + GRID;
        for (let gx = 0; gx < gw - 1; gx++) {
          const f00 = field[r0 + gx]!;
          const f10 = field[r0 + gx + 1]!;
          const f11 = field[r1 + gx + 1]!;
          const f01 = field[r1 + gx]!;
          let mask = 0;
          if (f00 >= ISO) mask |= 1;
          if (f10 >= ISO) mask |= 2;
          if (f11 >= ISO) mask |= 4;
          if (f01 >= ISO) mask |= 8;
          if (mask === 0 || mask === 15) continue;

          const x0 = gx * GRID;
          const x1 = x0 + GRID;

          let segs = CASES[mask]!;
          if (mask === 5 || mask === 10) {
            // saddle: the cell-centre sample decides whether the two inside
            // corners are joined through the middle or genuinely separate,
            // which is what makes a neck pinch instead of resolving as an X
            const inside = fieldAt(x0 + GRID / 2, y0 + GRID / 2) >= ISO;
            if (mask === 5) segs = inside ? [0, 1, 2, 3] : [3, 0, 1, 2];
            else segs = inside ? [3, 0, 1, 2] : [0, 1, 2, 3];
          }

          for (let s = 0; s < segs.length; s += 2) {
            const ea = segs[s]!;
            const eb = segs[s + 1]!;
            for (let k = 0; k < 2; k++) {
              const e = k === 0 ? ea : eb;
              let ptx = 0;
              let pty = 0;
              if (e === 0) {
                ptx = x0 + lerp(f00, f10) * GRID;
                pty = y0;
              } else if (e === 1) {
                ptx = x1;
                pty = y0 + lerp(f10, f11) * GRID;
              } else if (e === 2) {
                ptx = x1 - lerp(f11, f01) * GRID;
                pty = y1;
              } else {
                ptx = x0;
                pty = y1 - lerp(f01, f00) * GRID;
              }
              if (k === 0) path.moveTo(ptx, pty);
              else path.lineTo(ptx, pty);
            }
          }
        }
      }

      ctx.strokeStyle = ink;
      ctx.lineWidth = STROKE_W;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalAlpha = STROKE_A;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
    };

    const drawStill = () => {
      if (!sized) return;
      resolve(0);
      render();
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const moving = step(dt);
      resolve(t);
      render();
      // the loop only sleeps when the springs have settled AND there is no
      // ambient pulse left to render — i.e. never, unless motion is reduced
      raf = document.hidden || (reduced && !moving) ? 0 : requestAnimationFrame(loop);
    };

    const start = () => {
      if (reduced || raf) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    const sync = () => {
      relayout();
      if (!sized) return;
      if (reduced) {
        // no ambient motion, no glide: jump the anchors and repaint one frame
        seed();
        drawStill();
      } else {
        start();
      }
    };

    engineRef.current = {
      sync,
      setHover: (index, on) => {
        // reduced motion: the swell is a pointer-driven animation, so it is
        // dropped entirely rather than jumped to — the chip's own focus ring
        // still carries the cue
        if (reduced) return;
        const c = charges[index];
        if (!c) return;
        c.hover = on;
        start();
      },
    };

    const ro = new ResizeObserver(() => {
      const before = sized;
      resize();
      if (!sized) return;
      if (!before || !seeded) seed();
      if (reduced) drawStill();
      else start();
    });
    ro.observe(canvas);

    const mo = new MutationObserver(() => {
      readInk();
      if (reduced) drawStill();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVis);

    readInk();
    relayout();
    resize();
    if (sized) seed();
    if (reduced) drawStill();
    else start();

    return () => {
      engineRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [items]);

  const toggle = (id: string) => {
    setMembers((prev) => {
      const next = prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id];
      onChange?.(next);
      return next;
    });
  };

  const count = members.length;

  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: "6 / 5" }}>
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 block h-full w-full text-foreground"
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          role="group"
          aria-label={label}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {items.map((it, i) => {
            const isMember = members.includes(it.id);
            return (
              <button
                key={it.id}
                type="button"
                aria-pressed={isMember}
                onClick={() => toggle(it.id)}
                onPointerEnter={() => engineRef.current?.setHover(i, true)}
                onPointerLeave={() => engineRef.current?.setHover(i, false)}
                onFocus={() => engineRef.current?.setHover(i, true)}
                onBlur={() => engineRef.current?.setHover(i, false)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isMember
                    ? "border-foreground/40 text-foreground"
                    : "border-border text-ns-muted"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    isMember ? "bg-foreground" : "bg-border"
                  }`}
                />
                {it.label}
              </button>
            );
          })}
        </div>

        <p
          aria-hidden
          data-merged={count}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-ns-muted"
        >
          {count} of {items.length} in {label}
        </p>
        <span aria-live="polite" className="sr-only">
          {`${count} ${count === 1 ? "item" : "items"} grouped`}
        </span>
      </div>
    </div>
  );
}
