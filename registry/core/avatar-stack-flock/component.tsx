"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// FlockStack — team avatar stack that never sits still: at rest the avatars
// mill as a bounded boids flock (separation / alignment / cohesion + soft
// walls); hovering or keyboard-focusing the region ramps a seek force toward
// each avatar's slot in the classic overlapping row, SUMMED into the same
// three rules, so the tidy "group photo" is itself a settled flocking state.
// Pure DOM — per-frame transforms from a refs-only vector sim, no canvas, no
// React state on the hot path. Every color is a CSS token class (nothing is
// read via getComputedStyle, so there is nothing to re-derive on theme
// change — ring-background / border-border / bg-surface self-adapt). The +N
// badge fades in only once the formation resolves; once resolved AND settled
// the rAF loop genuinely sleeps until hover exit. Static resolved row under
// prefers-reduced-motion.
// ---------------------------------------------------------------------------

export interface FlockMember {
  name: string;
  /** 1–2 chars; derived from name when omitted */
  initials?: string;
  /** optional avatar image url; initials shown otherwise */
  src?: string;
}

const DEFAULT_MEMBERS: FlockMember[] = [
  { name: "Mara Chen" },
  { name: "Jonas Weber" },
  { name: "Aiko Tanaka" },
  { name: "Sam Okafor" },
  { name: "Lena Fischer" },
  { name: "Ravi Patel" },
  { name: "Nora Lindqvist" },
];

function initialsOf(m: FlockMember) {
  if (m.initials) return m.initials.slice(0, 2).toUpperCase();
  return m.name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// deterministic PRNG for the initial scatter (stable across strict-mode runs)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// sim constants — px, seconds
const SEP_R = 34;
const SEP_W = 1.4;
const ALI_R = 60;
const ALI_W = 0.6;
const COH_R = 90;
const COH_W = 0.5;
const MAX_SPEED = 60; // px/s while milling — keeps the ambient drift calm
const SEEK_MAX_SPEED = 480; // px/s ceiling while seeking, ramped in with seekT
const MAX_FORCE = 260; // steering clamp, px/s^2
const WALL_M = 24; // soft-wall ramp distance
const WALL_F = 300; // px/s^2 at the edge
const SEEK_W = 2.2; // full seek weight after the ramp
const SEEK_RAMP_S = 0.4; // seconds, both directions
const ARRIVE_R = 40; // arrival slowdown radius

export function FlockStack({
  members = DEFAULT_MEMBERS,
  overflow = 3,
  avatarSize = 28,
  className = "h-[120px]",
  "aria-label": ariaLabel,
}: {
  /** flocking avatars (<=12 recommended; sim is O(n^2)) */
  members?: FlockMember[];
  /** count in the "+N" badge shown once the flock resolves */
  overflow?: number;
  /** avatar diameter in px */
  avatarSize?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const badge = badgeRef.current; // null when overflow <= 0
    const items = itemRefs.current
      .slice(0, members.length)
      .filter((el): el is HTMLDivElement => el !== null);
    const n = items.length;
    if (n === 0) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const half = avatarSize / 2;

    // hot-path state — plain locals/arrays, never React state
    const px: number[] = new Array(n).fill(0);
    const py: number[] = new Array(n).fill(0);
    const vx: number[] = new Array(n).fill(0);
    const vy: number[] = new Array(n).fill(0);
    const wanderA: number[] = new Array(n).fill(0);
    const slotX: number[] = new Array(n).fill(0);
    let slotY = 0;
    let W = 0;
    let H = 0;
    let sized = false;

    const measure = () => {
      const r = region.getBoundingClientRect();
      W = r.width;
      H = r.height;
      // zero/tiny-size guard: no slots, no sim until we have real bounds
      sized = W >= avatarSize * 2 && H >= avatarSize + 8;
      if (!sized) return;
      const badgeCX = W - 16 - half;
      // classic -8 px overlap, compressed if the region is narrow
      const step = Math.min(
        avatarSize - 8,
        Math.max(6, (badgeCX - half - 12) / n)
      );
      slotY = H / 2;
      for (let i = 0; i < n; i++) slotX[i] = badgeCX - (n - i) * step;
      if (badge) {
        badge.style.transform = `translate3d(${badgeCX - half}px, ${slotY - half}px, 0)`;
      }
      // keep agents inside fresh bounds after a resize
      for (let i = 0; i < n; i++) {
        px[i] = Math.min(Math.max(px[i] ?? 0, half), W - half);
        py[i] = Math.min(Math.max(py[i] ?? 0, half), H - half);
      }
    };
    measure();

    // per-avatar hover: lift + tooltip, only once the formation is resolved
    let resolvedNow = reduced;
    const detachHover: Array<() => void> = [];
    items.forEach((el) => {
      const inner = el.querySelector<HTMLElement>("[data-avatar]");
      const tip = el.querySelector<HTMLElement>("[data-tip]");
      const baseZ = el.style.zIndex;
      const enter = () => {
        if (!resolvedNow) return;
        el.style.zIndex = "40";
        if (inner) inner.style.transform = "translateY(-3px)";
        if (tip) tip.style.opacity = "1";
      };
      const leave = () => {
        el.style.zIndex = baseZ;
        if (inner) inner.style.transform = "";
        if (tip) tip.style.opacity = "0";
      };
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      detachHover.push(() => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      });
    });

    // ------------------------------------------------------------------
    // reduced motion: static two-state — resolved row, badge always on,
    // no milling ever; tooltips/lift still work (CSS transitions only)
    // ------------------------------------------------------------------
    if (reduced) {
      const place = () => {
        measure();
        if (!sized) return;
        items.forEach((el, i) => {
          el.style.transform = `translate3d(${(slotX[i] ?? 0) - half}px, ${slotY - half}px, 0)`;
          el.style.opacity = "1";
        });
        if (badge) badge.style.opacity = "1";
      };
      region.dataset.resolved = "true";
      place();
      const ro = new ResizeObserver(place);
      ro.observe(region);
      return () => {
        ro.disconnect();
        detachHover.forEach((f) => f());
      };
    }

    // ------------------------------------------------------------------
    // animated path
    // ------------------------------------------------------------------
    const rand = mulberry32(0xf10c5 + n);
    let seeded = false;
    const seed = () => {
      if (seeded || !sized) return;
      for (let i = 0; i < n; i++) {
        px[i] = half + 8 + rand() * Math.max(1, W - avatarSize - 16);
        py[i] = half + 8 + rand() * Math.max(1, H - avatarSize - 16);
        const a = rand() * Math.PI * 2;
        vx[i] = Math.cos(a) * MAX_SPEED * 0.5;
        vy[i] = Math.sin(a) * MAX_SPEED * 0.5;
        wanderA[i] = a;
      }
      items.forEach((el) => {
        el.style.opacity = "1";
      });
      seeded = true;
    };
    seed();

    let raf = 0;
    let last = 0;
    let ioVisible = true;
    let docVisible = !document.hidden;
    let hovered = false;
    let focused = false;
    let seekT = 0; // 0..1, ramps over SEEK_RAMP_S both ways
    let sleeping = false;

    const setResolved = (v: boolean) => {
      if (resolvedNow === v) return;
      resolvedNow = v;
      region.dataset.resolved = v ? "true" : "false";
      if (badge) badge.style.opacity = v ? "1" : "0";
    };

    const clampScale = (x: number, y: number) => {
      const l = Math.hypot(x, y);
      return l > MAX_FORCE ? MAX_FORCE / l : 1;
    };

    function step(now: number) {
      raf = 0;
      if (!seeded) seed();
      if (!sized || !seeded) return; // ResizeObserver wakes us with real bounds
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      const wantSeek = hovered || focused;
      seekT = Math.min(
        1,
        Math.max(0, seekT + ((wantSeek ? 1 : -1) * dt) / SEEK_RAMP_S)
      );
      const seekW = SEEK_W * seekT;
      const mill = 1 - seekT; // milling drive fades as the seek ramps in
      // the three rules stay summed, attenuated so arrival can actually settle —
      // must reach exactly 0 at full seek (mirrors `mill`) or a residual
      // separation force fights the seek force forever at tight slot spacing
      const flockW = Math.max(0, 1 - seekT);
      // milling's MAX_SPEED (60 px/s) is deliberately slow for a calm resting
      // drift, but that same cap made a from-scatter seek arrival take
      // 5-6+ seconds — far past the 400ms seek-ramp. Ramp a higher travel
      // ceiling in with seekT so milling speed is untouched at rest and the
      // seek phase alone gets a real sprint toward the slot.
      const travelCap = MAX_SPEED + (SEEK_MAX_SPEED - MAX_SPEED) * seekT;

      const damp = Math.pow(0.98, dt * 60);
      let allNear = true;
      let allStill = true;
      // position-only — deliberately NOT the same test as `allNear` (which
      // also gates on speed): a wake-from-sleep velocity kick can trip a
      // speed threshold for a frame without the avatar visibly leaving its
      // slot, and clearing the badge on that alone is exactly the flicker.
      let anyDeparted = false;

      for (let i = 0; i < n; i++) {
        const xi = px[i] ?? 0;
        const yi = py[i] ?? 0;
        let vxi = vx[i] ?? 0;
        let vyi = vy[i] ?? 0;
        let ax = 0;
        let ay = 0;

        // neighbor accumulation (n <= 12 → O(n^2) is nothing)
        let sx = 0;
        let sy = 0;
        let sc = 0;
        let alx = 0;
        let aly = 0;
        let ac = 0;
        let cxs = 0;
        let cys = 0;
        let cc = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          let dx = xi - (px[j] ?? 0);
          let dy = yi - (py[j] ?? 0);
          let d = Math.hypot(dx, dy);
          if (d < 1e-4) {
            // coincident agents: deterministic nudge, never a zero-length vector
            dx = i > j ? 0.01 : -0.01;
            dy = 0;
            d = 0.01;
          }
          if (d < SEP_R) {
            const f = (1 - d / SEP_R) / d;
            sx += dx * f;
            sy += dy * f;
            sc++;
          }
          if (d < ALI_R) {
            alx += vx[j] ?? 0;
            aly += vy[j] ?? 0;
            ac++;
          }
          if (d < COH_R) {
            cxs += px[j] ?? 0;
            cys += py[j] ?? 0;
            cc++;
          }
        }

        // Reynolds steering: desired velocity − current, clamped to MAX_FORCE
        if (sc > 0) {
          const m = Math.hypot(sx, sy);
          if (m > 1e-5) {
            const fx = (sx / m) * MAX_SPEED - vxi;
            const fy = (sy / m) * MAX_SPEED - vyi;
            const s = clampScale(fx, fy);
            ax += SEP_W * flockW * fx * s;
            ay += SEP_W * flockW * fy * s;
          }
        }
        if (ac > 0) {
          const mvx = alx / ac;
          const mvy = aly / ac;
          const m = Math.hypot(mvx, mvy);
          if (m > 1e-5) {
            const fx = (mvx / m) * MAX_SPEED - vxi;
            const fy = (mvy / m) * MAX_SPEED - vyi;
            const s = clampScale(fx, fy);
            ax += ALI_W * flockW * fx * s;
            ay += ALI_W * flockW * fy * s;
          }
        }
        if (cc > 0) {
          const tx = cxs / cc - xi;
          const ty = cys / cc - yi;
          const m = Math.hypot(tx, ty);
          if (m > 1e-5) {
            const fx = (tx / m) * MAX_SPEED - vxi;
            const fy = (ty / m) * MAX_SPEED - vyi;
            const s = clampScale(fx, fy);
            ax += COH_W * flockW * fx * s;
            ay += COH_W * flockW * fy * s;
          }
        }

        // milling drive: wander random-walk + cruise thrust, fades with seek
        if (mill > 0.001) {
          wanderA[i] = (wanderA[i] ?? 0) + (Math.random() * 2 - 1) * 4 * dt;
          const wa = wanderA[i] ?? 0;
          ax += Math.cos(wa) * 28 * mill;
          ay += Math.sin(wa) * 28 * mill;
          const sp = Math.hypot(vxi, vyi);
          if (sp > 1e-3) {
            const thrust = (MAX_SPEED * 0.65 - sp) * 1.6 * mill;
            ax += (vxi / sp) * thrust;
            ay += (vyi / sp) * thrust;
          } else {
            ax += Math.cos(wa) * 60 * mill;
            ay += Math.sin(wa) * 60 * mill;
          }
        }

        // soft walls: force ramps to WALL_F inside WALL_M of the region edge
        const dl = xi - half;
        if (dl < WALL_M) ax += WALL_F * (1 - Math.max(0, dl) / WALL_M);
        const dr = W - half - xi;
        if (dr < WALL_M) ax -= WALL_F * (1 - Math.max(0, dr) / WALL_M);
        const dtp = yi - half;
        if (dtp < WALL_M) ay += WALL_F * (1 - Math.max(0, dtp) / WALL_M);
        const db = H - half - yi;
        if (db < WALL_M) ay -= WALL_F * (1 - Math.max(0, db) / WALL_M);

        // seek to slot: summed into the same field, arrival slowdown < 40 px
        const sxT = slotX[i] ?? 0;
        if (seekW > 0) {
          const dx = sxT - xi;
          const dy = slotY - yi;
          const d = Math.hypot(dx, dy);
          if (d > 1e-4) {
            const spd = d < ARRIVE_R ? travelCap * (d / ARRIVE_R) : travelCap;
            const fx = (dx / d) * spd - vxi;
            const fy = (dy / d) * spd - vyi;
            const s = clampScale(fx, fy);
            ax += seekW * fx * s;
            ay += seekW * fy * s;
          }
        }

        // integrate: damping 0.98/frame normalized, speed cap ramps with seekT
        vxi = (vxi + ax * dt) * damp;
        vyi = (vyi + ay * dt) * damp;
        const sp2 = Math.hypot(vxi, vyi);
        if (sp2 > travelCap) {
          const s = travelCap / sp2;
          vxi *= s;
          vyi *= s;
        }
        let nx = xi + vxi * dt;
        let ny = yi + vyi * dt;

        // capture assist at full ramp: physics carries the approach, this
        // closes the last few px so the 2 px / 1 px/s gate is reachable
        if (seekT > 0.95) {
          const ddx = sxT - nx;
          const ddy = slotY - ny;
          if (Math.hypot(ddx, ddy) < 8) {
            const k = Math.min(1, 10 * dt);
            nx += ddx * k;
            ny += ddy * k;
            const kd = Math.pow(0.8, dt * 60);
            vxi *= kd;
            vyi *= kd;
          }
        }

        // hard containment safety net (soft walls do the real work)
        if (nx < half) {
          nx = half;
          vxi = Math.abs(vxi);
        } else if (nx > W - half) {
          nx = W - half;
          vxi = -Math.abs(vxi);
        }
        if (ny < half) {
          ny = half;
          vyi = Math.abs(vyi);
        } else if (ny > H - half) {
          ny = H - half;
          vyi = -Math.abs(vyi);
        }

        px[i] = nx;
        py[i] = ny;
        vx[i] = vxi;
        vy[i] = vyi;

        const speed = Math.hypot(vxi, vyi);
        const slotDist = Math.hypot(sxT - nx, slotY - ny);
        if (slotDist > 2 || speed >= 1) allNear = false;
        if (speed >= 0.5) allStill = false;
        if (slotDist > 2) anyDeparted = true;

        const el = items[i];
        if (el) {
          el.style.transform = `translate3d(${nx - half}px, ${ny - half}px, 0)`;
        }
      }

      // badge clears only once an avatar has actually left its slot (position,
      // not the speed-inclusive `allNear`) — not on every momentary
      // pointer-out, so a hover blip that never visibly moves the row can't
      // flicker the badge
      if (resolvedNow && anyDeparted) setResolved(false);

      if (wantSeek && seekT >= 1) {
        if (allNear) setResolved(true);
        if (allNear && allStill) {
          // snap exactly to slots, zero out, and genuinely sleep
          for (let i = 0; i < n; i++) {
            const sxT = slotX[i] ?? 0;
            px[i] = sxT;
            py[i] = slotY;
            vx[i] = 0;
            vy[i] = 0;
            const el = items[i];
            if (el) {
              el.style.transform = `translate3d(${sxT - half}px, ${slotY - half}px, 0)`;
            }
          }
          sleeping = true;
          last = 0;
          return;
        }
      }

      if (ioVisible && docVisible && !sleeping) {
        raf = requestAnimationFrame(step);
      }
    }

    const wake = () => {
      sleeping = false;
      if (raf === 0 && ioVisible && docVisible) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const pause = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      last = 0;
    };

    const onEnter = () => {
      hovered = true;
      wake();
    };
    const onLeave = () => {
      hovered = false;
      wake();
    };
    const onFocus = () => {
      // keyboard focus behaves like hover; pointer clicks don't lock the row
      focused = region.matches(":focus-visible");
      if (focused) wake();
    };
    const onBlur = () => {
      if (focused) {
        focused = false;
        wake();
      }
    };
    const onVis = () => {
      docVisible = !document.hidden;
      if (!docVisible) pause();
      else wake();
    };
    region.addEventListener("pointerenter", onEnter);
    region.addEventListener("pointerleave", onLeave);
    region.addEventListener("focus", onFocus);
    region.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);

    // milling is the ambient default, so "sleep" also means: pause offscreen
    const io = new IntersectionObserver((entries) => {
      ioVisible = entries[0]?.isIntersecting ?? true;
      if (!ioVisible) pause();
      else wake();
    });
    io.observe(region);

    const ro = new ResizeObserver(() => {
      measure();
      seed();
      wake();
    });
    ro.observe(region);

    raf = requestAnimationFrame(step);

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      region.removeEventListener("pointerenter", onEnter);
      region.removeEventListener("pointerleave", onLeave);
      region.removeEventListener("focus", onFocus);
      region.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      detachHover.forEach((f) => f());
    };
  }, [members, avatarSize]);

  const label =
    ariaLabel ??
    `Team: ${members.map((m) => m.name).join(", ")}${
      overflow > 0 ? ` and ${overflow} more` : ""
    }`;

  return (
    <div
      ref={regionRef}
      tabIndex={0}
      role="group"
      aria-label={label}
      data-resolved="false"
      className={`relative w-full rounded-sm border border-border/60 bg-background/40 transition-colors hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${className}`}
    >
      {members.map((m, i) => (
        <div
          key={`${m.name}-${i}`}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 transition-opacity duration-300 will-change-transform"
          style={{ width: avatarSize, height: avatarSize, zIndex: i + 1, opacity: 0 }}
        >
          <div
            data-avatar
            className="flex h-full w-full select-none items-center justify-center rounded-full border border-border bg-surface font-mono text-[9px] font-medium text-ns-muted ring-2 ring-background transition-transform duration-200"
          >
            {m.src ? (
              <img
                src={m.src}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initialsOf(m)
            )}
          </div>
          <div
            data-tip
            aria-hidden
            className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-foreground opacity-0 shadow-sm transition-opacity duration-150"
          >
            {m.name}
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div
          ref={badgeRef}
          className="absolute left-0 top-0 flex select-none items-center justify-center rounded-full border border-border bg-surface font-mono text-[10px] text-ns-muted ring-2 ring-background transition-opacity duration-200"
          style={{
            width: avatarSize,
            height: avatarSize,
            zIndex: members.length + 1,
            opacity: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
