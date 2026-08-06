"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// SedimentStack — toasts fall under real gravity and pile into a jostling
// heap at the base of a docked surface. Severity sets mass (errors thud in
// heavy and migrate down, info lands light on top); dismissing mid-pile
// removes the collision body and the sediment above resettles. DOM cards,
// transforms written per-frame by a rigid-body-lite 2D sim — refs only on
// the hot path, and the whole sim sleeps once the pile settles.
// ---------------------------------------------------------------------------

export type SedimentSeverity = "error" | "warning" | "info";

export interface SedimentToastInput {
  severity?: SedimentSeverity;
  title: string;
  message?: string;
  /** ms before auto-dismiss; 0 disables; defaults to the stack `duration` */
  duration?: number;
}

export interface SedimentStackHandle {
  /** drop a toast into the pile, returns its id */
  push: (toast: SedimentToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

type ToastRec = {
  id: string;
  severity: SedimentSeverity;
  title: string;
  message?: string;
  duration: number;
};

type Body = {
  id: string;
  el: HTMLDivElement;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  om: number;
  hw: number;
  hh: number;
  /** collision circle radius (half card height → rounded-box proxy) */
  r: number;
  /** local x offsets of the collision circles along the card's midline */
  lxs: number[];
  bound: number;
  invMass: number;
  invI: number;
  baseInvMass: number;
  baseInvI: number;
  born: number;
  dead: boolean;
  dragging: boolean;
  dragPX: number;
  dragX0: number;
  dragLastX: number;
  dragLastT: number;
  dragVX: number;
  spring: boolean;
  anchorX: number;
  hovered: boolean;
  /** frozen into static geometry (invMass 0) after 12 calm frames */
  asleep: boolean;
  calm: number;
  /** seconds awake since spawn/wake — drives the forced-settle rule */
  age: number;
};

type TimerEntry = {
  handle: number | null;
  deadline: number;
  remaining: number;
};

// tray composition only (not a sim constant): keeps the physics floor a few
// px above the frame's visible bottom edge so a rotated card's circle-proxy
// corner overhang never visually crosses the clipped edge
const FLOOR_INSET = 6;

// severity → left-rail color only; the card itself stays on neutral tokens
const RAIL: Record<SedimentSeverity, string> = {
  error: "var(--error, #ea001d)",
  warning: "var(--warning, #f5a623)",
  info: "var(--success, #47a447)",
};

const ICONS: Record<SedimentSeverity, ReactNode> = {
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 2.7 19a1.5 1.5 0 0 0 1.3 2.3h16a1.5 1.5 0 0 0 1.3-2.3L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17.4h.01" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  ),
};

function CardInner({
  toast,
  onDismiss,
}: {
  toast: ToastRec;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2 pl-3 pr-1.5">
      <span className="mt-0.5 shrink-0 text-ns-muted">{ICONS[toast.severity]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-foreground">
          {toast.title}
        </p>
        {toast.message ? (
          <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-ns-muted">
            {toast.message}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={`Dismiss: ${toast.title}`}
        onClick={onDismiss}
        className="shrink-0 cursor-pointer rounded-sm p-1 text-ns-muted transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ns-accent"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// reduced-motion fallback card: classic list entry, 150ms opacity fade in/out
function ReducedCard({
  toast,
  exiting,
  onDismiss,
  onEnter,
  onLeave,
}: {
  toast: ToastRec;
  exiting: boolean;
  onDismiss: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      role={toast.severity === "error" ? "alert" : "status"}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className={`w-full rounded-sm border border-border bg-surface transition-opacity duration-150 hover:border-foreground/20 ${
        shown && !exiting ? "opacity-100" : "opacity-0"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: RAIL[toast.severity] }}
    >
      <CardInner toast={toast} onDismiss={onDismiss} />
    </div>
  );
}

export const SedimentStack = forwardRef<
  SedimentStackHandle,
  {
    /** ms before a toast auto-dismisses (paused on hover); 0 disables */
    duration?: number;
    /** px/s^2 downward */
    gravity?: number;
    /** bounce energy kept on impact, 0..1 */
    restitution?: number;
    /** toasts present at mount */
    initial?: SedimentToastInput[];
    /** extra classes merged onto the rendered root element */
    className?: string;
    /** accessible name for the toast stack. Default "Notifications". */
    "aria-label"?: string;
  }
>(function SedimentStack(
  {
    duration = 6000,
    gravity = 1800,
    restitution = 0.15,
    initial,
    className = "h-96",
    "aria-label": ariaLabel = "Notifications",
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef<Map<string, Body>>(new Map());
  const timersRef = useRef<Map<string, TimerEntry>>(new Map());
  const removalsRef = useRef<Set<number>>(new Set());
  const dismissedRef = useRef<Set<string>>(new Set());
  const wakeRef = useRef<() => void>(() => {});
  const kickRef = useRef<() => void>(() => {});
  const shadowRef = useRef("0 10px 24px -10px rgba(0,0,0,0.28)");
  const restShadowRef = useRef("0 3px 10px -6px rgba(0,0,0,0.3)");
  const seqRef = useRef(0);
  const bornRef = useRef(0);
  const spawnSlotRef = useRef(0);

  const [toasts, setToasts] = useState<ToastRec[]>(() =>
    (initial ?? []).map((t, i) => ({
      id: `sed-init-${i}`,
      severity: t.severity ?? "info",
      title: t.title,
      message: t.message,
      duration: t.duration ?? duration,
    }))
  );
  const [exiting, setExiting] = useState<ReadonlySet<string>>(new Set());
  const [reduced, setReduced] = useState(false);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // hover-lift + resting shadows are tinted from a fixed dark "ink" (always
  // rgba(0,0,0,...)), not a theme token — a shadow needs to stay dark in
  // both themes, unlike --foreground which flips to near-white in dark mode
  // and would otherwise paint a light halo around every card. Resting shadow
  // is a subtle version applied to every settled card so the pile reads as
  // sitting under real weight, not flat cutouts. shadowRef/restShadowRef are
  // already seeded with these constants at declaration, so no derive effect
  // is needed here.

  // oldest layers fade toward 0.55 as newer sediment lands on top
  const recomputeDepth = useCallback(() => {
    const alive: Body[] = [];
    for (const b of bodiesRef.current.values()) if (!b.dead) alive.push(b);
    alive.sort((a, b) => a.born - b.born);
    const n = alive.length;
    for (let i = 0; i < n; i++) {
      alive[i].el.style.opacity = Math.max(0.55, 1 - (n - 1 - i) * 0.06).toFixed(2);
    }
  }, []);

  const pauseTimer = useCallback((id: string) => {
    const entry = timersRef.current.get(id);
    if (!entry || entry.handle === null) return;
    clearTimeout(entry.handle);
    entry.handle = null;
    entry.remaining = Math.max(0, entry.deadline - Date.now());
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const entry = timersRef.current.get(id);
      if (entry) {
        if (entry.handle !== null) clearTimeout(entry.handle);
        timersRef.current.delete(id);
      }
      if (dismissedRef.current.has(id)) return;
      dismissedRef.current.add(id);
      const body = bodiesRef.current.get(id);
      if (body && !body.dead) {
        // collision body gone immediately — the pile above resettles while
        // the card fades out over 150ms
        body.dead = true;
        body.dragging = false;
        body.el.style.opacity = "0";
      }
      setExiting((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      const handle = window.setTimeout(() => {
        removalsRef.current.delete(handle);
        dismissedRef.current.delete(id);
        bodiesRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
        setExiting((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        recomputeDepth();
        wakeRef.current();
      }, 180);
      removalsRef.current.add(handle);
      wakeRef.current();
    },
    [recomputeDepth]
  );

  const resumeTimer = useCallback(
    (id: string) => {
      const entry = timersRef.current.get(id);
      if (!entry || entry.handle !== null) return;
      const ms = Math.max(400, entry.remaining);
      entry.deadline = Date.now() + ms;
      entry.handle = window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  // arm auto-dismiss timers for freshly pushed toasts
  useEffect(() => {
    const timers = timersRef.current;
    for (const t of toasts) {
      if (t.duration <= 0 || timers.has(t.id) || dismissedRef.current.has(t.id))
        continue;
      timers.set(t.id, {
        handle: window.setTimeout(() => dismiss(t.id), t.duration),
        deadline: Date.now() + t.duration,
        remaining: t.duration,
      });
    }
  }, [toasts, dismiss]);

  // teardown: every pending timer and removal timeout dies with the component
  useEffect(() => {
    const timers = timersRef.current;
    const removals = removalsRef.current;
    return () => {
      for (const entry of timers.values()) {
        if (entry.handle !== null) clearTimeout(entry.handle);
      }
      timers.clear();
      for (const handle of removals) clearTimeout(handle);
      removals.clear();
    };
  }, []);

  const push = useCallback(
    (input: SedimentToastInput) => {
      const id = `sed-${++seqRef.current}`;
      setToasts((prev) => [
        ...prev,
        {
          id,
          severity: input.severity ?? "info",
          title: input.title,
          message: input.message,
          duration: input.duration ?? duration,
        },
      ]);
      return id;
    },
    [duration]
  );

  const clear = useCallback(() => {
    for (const t of toastsRef.current) dismiss(t.id);
  }, [dismiss]);

  useImperativeHandle(ref, () => ({ push, dismiss, clear }), [push, dismiss, clear]);

  // spawn a rigid body the moment a card element mounts: entry x round-robins
  // across a handful of tray-width slots (jittered) so the pile heaps instead
  // of sliding in from one edge, vx jitter ±40 px/s, rotation jitter ±4°,
  // mass by severity (3/2/1)
  const attach = useCallback(
    (t: ToastRec, el: HTMLDivElement | null) => {
      const bodies = bodiesRef.current;
      const existing = bodies.get(t.id);
      if (!el) {
        // re-render ref churn detaches then reattaches the same node; only a
        // dismissed body is truly gone
        if (existing && existing.dead) bodies.delete(t.id);
        return;
      }
      if (existing) {
        // Only a genuinely new node (real remount) should wake the sim —
        // the churn case above reattaches this exact same element on every
        // unrelated re-render of the list, and waking on every one of those
        // resets the settle deadline continuously, so the sim never parks.
        const isNewNode = existing.el !== el;
        existing.el = el;
        if (isNewNode) wakeRef.current();
        return;
      }
      const root = containerRef.current;
      const cw = root ? root.clientWidth : 0;
      const w = el.offsetWidth || 288;
      const h = el.offsetHeight || 60;
      const hw = w / 2;
      const hh = h / 2;
      const r = hh; // rounded-box proxy: circles of half-height radius
      const span = Math.max(0, hw - r);
      const count = Math.max(2, Math.ceil((span * 2) / (r * 1.2)) + 1);
      const lxs: number[] = [];
      for (let i = 0; i < count; i++)
        lxs.push(-span + (span * 2 * i) / (count - 1));
      const mass = t.severity === "error" ? 3 : t.severity === "warning" ? 2 : 1;
      const inertia = (mass * (w * w + h * h)) / 12;
      // distribute drop x across up to 4 tray slots (round-robin + jitter)
      // instead of always the far-right edge, so the pile heaps rather than
      // sliding in flat from one side
      const SLOT_COUNT = 4;
      const slotLeft = hw + 8;
      const slotRight = cw - hw - 8;
      const slotSpan = slotRight - slotLeft;
      let x: number;
      if (cw > w + 40 && slotSpan > 0) {
        const n = Math.min(SLOT_COUNT, Math.max(1, Math.floor(slotSpan / 40) + 1));
        const slot = spawnSlotRef.current % n;
        spawnSlotRef.current++;
        const frac = n === 1 ? 0.5 : slot / (n - 1);
        const jitter = (Math.random() - 0.5) * Math.min(28, slotSpan / n);
        x = Math.min(slotRight, Math.max(slotLeft, slotLeft + frac * slotSpan + jitter));
      } else {
        x = Math.max(hw + 2, cw - hw - 2);
      }
      const body: Body = {
        id: t.id,
        el,
        x,
        y: -hh - 6,
        a: (Math.random() - 0.5) * ((8 * Math.PI) / 180),
        vx: (Math.random() - 0.5) * 40,
        vy: 0,
        om: 0,
        hw,
        hh,
        r,
        lxs,
        bound: Math.hypot(hw, hh) + 2,
        invMass: 1 / mass,
        invI: 1 / inertia,
        baseInvMass: 1 / mass,
        baseInvI: 1 / inertia,
        born: ++bornRef.current,
        dead: false,
        dragging: false,
        dragPX: 0,
        dragX0: 0,
        dragLastX: 0,
        dragLastT: 0,
        dragVX: 0,
        spring: false,
        anchorX: 0,
        hovered: false,
        asleep: false,
        calm: 0,
        age: 0,
      };
      el.style.transform = `translate3d(${(body.x - hw).toFixed(2)}px, ${(body.y - hh).toFixed(2)}px, 0) rotate(${body.a.toFixed(4)}rad)`;
      el.style.boxShadow = restShadowRef.current;
      bodies.set(t.id, body);
      recomputeDepth();
      wakeRef.current();
    },
    [recomputeDepth]
  );

  // -------------------------------------------------------------------------
  // the sim — fixed 120Hz substeps, impulse contacts, sleeps when settled
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (reduced) return;
    const root = containerRef.current;
    if (!root) return;

    let W = root.clientWidth;
    let H = root.clientHeight;
    let raf = 0;
    let last = 0;
    let acc = 0;
    // seconds of live sim since the last real wake — the global settle deadline
    let active = 0;

    const FIXED = 1 / 120;
    // ponytail: superphysical stiction (cone past 45°) — at 0.85 any contact
    // steeper than ~40° slides under gravity and the pile reorganizes for
    // minutes, never reaching the sleep epsilon; cards in a tray should lock
    const MU = 1.2;
    const SPRING_K = 180; // swipe spring-back stiffness (s^-2)
    const SPRING_C = 2 * 0.9 * Math.sqrt(SPRING_K); // zeta = 0.9

    const pa: number[] = new Array(64).fill(0);
    const pb: number[] = new Array(64).fill(0);

    const worldPts = (b: Body, out: number[]) => {
      const cos = Math.cos(b.a);
      const sin = Math.sin(b.a);
      for (let i = 0; i < b.lxs.length; i++) {
        const lx = b.lxs[i];
        out[i * 2] = b.x + lx * cos;
        out[i * 2 + 1] = b.y + lx * sin;
      }
    };

    // impulse + Baumgarte projection at one contact point; B null = static
    const applyContact = (
      A: Body,
      B: Body | null,
      px: number,
      py: number,
      nx: number,
      ny: number,
      pen: number
    ) => {
      const rax = px - A.x;
      const ray = py - A.y;
      let rbx = 0;
      let rby = 0;
      let invMB = 0;
      let invIB = 0;
      let vbx = 0;
      let vby = 0;
      let wb = 0;
      if (B) {
        rbx = px - B.x;
        rby = py - B.y;
        invMB = B.invMass;
        invIB = B.invI;
        vbx = B.vx;
        vby = B.vy;
        wb = B.om;
      }
      const invSum = A.invMass + invMB;
      if (invSum > 0 && pen > 0.5) {
        const corr = ((pen - 0.5) / invSum) * 0.3;
        A.x -= corr * A.invMass * nx;
        A.y -= corr * A.invMass * ny;
        if (B) {
          B.x += corr * B.invMass * nx;
          B.y += corr * B.invMass * ny;
        }
      }
      const rvx = vbx - wb * rby - (A.vx - A.om * ray);
      const rvy = vby + wb * rbx - (A.vy + A.om * rax);
      const vn = rvx * nx + rvy * ny;
      if (vn >= 0) return;
      const raXn = rax * ny - ray * nx;
      const rbXn = rbx * ny - rby * nx;
      const kn = invSum + raXn * raXn * A.invI + rbXn * rbXn * invIB;
      if (kn <= 0) return;
      const e = vn < -80 ? restitution : 0;
      const j = (-(1 + e) * vn) / kn;
      A.vx -= j * nx * A.invMass;
      A.vy -= j * ny * A.invMass;
      A.om -= j * raXn * A.invI;
      if (B) {
        B.vx += j * nx * B.invMass;
        B.vy += j * ny * B.invMass;
        B.om += j * rbXn * B.invI;
      }
      let tx = rvx - vn * nx;
      let ty = rvy - vn * ny;
      const tl = Math.hypot(tx, ty);
      if (tl > 1e-6) {
        tx /= tl;
        ty /= tl;
        const raXt = rax * ty - ray * tx;
        const rbXt = rbx * ty - rby * tx;
        const kt = invSum + raXt * raXt * A.invI + rbXt * rbXt * invIB;
        if (kt > 0) {
          let jt = -(rvx * tx + rvy * ty) / kt;
          const maxF = MU * j;
          if (jt > maxF) jt = maxF;
          else if (jt < -maxF) jt = -maxF;
          A.vx -= jt * tx * A.invMass;
          A.vy -= jt * ty * A.invMass;
          A.om -= jt * raXt * A.invI;
          if (B) {
            B.vx += jt * tx * B.invMass;
            B.vy += jt * ty * B.invMass;
            B.om += jt * rbXt * B.invI;
          }
        }
      }
    };

    const step = (dt: number, bodies: Body[]) => {
      for (const b of bodies) {
        if (b.invMass === 0) continue; // dragged bodies are kinematic
        b.vy += gravity * dt;
        b.age += dt;
        if (b.spring) {
          b.vx += (-SPRING_K * (b.x - b.anchorX) - SPRING_C * b.vx) * dt;
          if (Math.abs(b.x - b.anchorX) < 0.5 && Math.abs(b.vx) < 3)
            b.spring = false;
        }
      }
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < bodies.length; i++) {
          const A = bodies[i];
          worldPts(A, pa);
          for (let ci = 0; ci < A.lxs.length; ci++) {
            const cxw = pa[ci * 2];
            const cyw = pa[ci * 2 + 1];
            const overFloor = cyw + A.r - H;
            if (overFloor > 0) applyContact(A, null, cxw, H, 0, 1, overFloor);
            const overLeft = A.r - cxw;
            if (overLeft > 0) applyContact(A, null, 0, cyw, -1, 0, overLeft);
            const overRight = cxw + A.r - W;
            if (overRight > 0) applyContact(A, null, W, cyw, 1, 0, overRight);
          }
          for (let jn = i + 1; jn < bodies.length; jn++) {
            const B = bodies[jn];
            if (A.asleep && B.asleep) continue; // both frozen — nothing to solve
            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const rr = A.bound + B.bound;
            if (dx * dx + dy * dy > rr * rr) continue;
            // an energetic awake body crashing into frozen geometry wakes it
            if (A.asleep !== B.asleep) {
              const mover = A.asleep ? B : A;
              const frozen = A.asleep ? A : B;
              if (!frozen.dragging && Math.hypot(mover.vx, mover.vy) > 60) {
                frozen.asleep = false;
                frozen.calm = 0;
                frozen.age = 0;
                frozen.invMass = frozen.baseInvMass;
                frozen.invI = frozen.baseInvI;
              }
            }
            worldPts(B, pb);
            const rsum = A.r + B.r;
            for (let pi = 0; pi < A.lxs.length; pi++) {
              for (let qi = 0; qi < B.lxs.length; qi++) {
                const ddx = pb[qi * 2] - pa[pi * 2];
                const ddy = pb[qi * 2 + 1] - pa[pi * 2 + 1];
                const d2 = ddx * ddx + ddy * ddy;
                if (d2 >= rsum * rsum) continue;
                const d = Math.sqrt(d2);
                // coincident centers: fall back to a vertical normal —
                // never divide by a zero-length vector
                let nx = 0;
                let ny = -1;
                if (d > 1e-6) {
                  nx = ddx / d;
                  ny = ddy / d;
                }
                const pen = rsum - d;
                applyContact(
                  A,
                  B,
                  pa[pi * 2] + nx * (A.r - pen / 2),
                  pa[pi * 2 + 1] + ny * (A.r - pen / 2),
                  nx,
                  ny,
                  pen
                );
              }
            }
          }
        }
      }
      for (const b of bodies) {
        if (b.invMass === 0) continue;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 1400) {
          const s = 1400 / sp;
          b.vx *= s;
          b.vy *= s;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a += b.om * dt;
        // framerate-normalized angular damping (0.92 per 60Hz frame)
        b.om *= Math.pow(0.92, dt * 60);
        // chatter damping: a body wedged between frozen (infinite-mass)
        // neighbors ping-pongs impulses at 10-20px/s forever — drain any
        // sub-30px/s motion hard so it dips under the sleep epsilon
        if (Math.abs(b.vx) < 30 && Math.abs(b.vy) < 30) {
          b.vx *= 0.85;
          b.vy *= 0.85;
          b.om *= 0.85;
        }
      }
    };

    const loop = (now: number) => {
      raf = 0;
      const dtF = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const bodies: Body[] = [];
      for (const b of bodiesRef.current.values()) if (!b.dead) bodies.push(b);

      // zero-size guard: bodies wait until the container has real bounds
      if (W > 4 && H > 4 && bodies.length > 0) {
        active += dtF;
        acc = Math.min(acc + dtF, FIXED * 6);
        while (acc >= FIXED) {
          step(FIXED, bodies);
          acc -= FIXED;
        }
        for (const b of bodies) {
          const tx = b.x - b.hw;
          const ty = b.y - b.hh + (b.hovered ? -2 : 0);
          b.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotate(${b.a.toFixed(4)}rad)`;
        }
      }

      // per-body sleep: a body calm (|v| < 3 px/s, |ω| < 0.02 rad/s, no
      // spring/drag) for 12 consecutive frames freezes into static geometry
      // (invMass 0) so the pile locks progressively instead of reorganizing
      // forever. Loop parks when everything is frozen; spawn/dismiss/resize
      // full-wake, an energetic contact wakes one frozen body.
      // global settle deadline: 4s after the last real wake, everything
      // freezes unconditionally — no per-body wake/reset path can evade it.
      // The pile must reach exact rest deterministically; the sim is for the
      // landing choreography, not for eternal micro-motion.
      const deadline = active > 4;
      let allAsleep = true;
      for (const b of bodies) {
        if (b.dragging) {
          allAsleep = false;
          continue;
        }
        if (b.asleep) continue;
        // forced settle: a UI pile must reach rest deterministically and a
        // free impulse sim never quite does (wedged bodies chatter between
        // frozen infinite-mass neighbors). Any body awake > 2.5s and moving
        // under 40px/s parks on the spot — imperceptible at that speed.
        // ponytail: fiat rest; revisit only if piles photograph mid-topple
        // hard stop at 4s: a card can toboggan down a frozen neighbor's
        // scalloped (circle-proxy) edge at 40-60px/s indefinitely — nothing
        // in a toast pile legitimately animates that long, and every
        // spawn/drag/dismiss resets the clock
        if (
          deadline ||
          b.age > 4 ||
          (!b.spring &&
            b.age > 2.5 &&
            Math.hypot(b.vx, b.vy) < 40 &&
            Math.abs(b.om) < 0.3)
        ) {
          b.spring = false;
          b.asleep = true;
          b.vx = 0;
          b.vy = 0;
          b.om = 0;
          b.invMass = 0;
          b.invI = 0;
          continue;
        }
        // 8px/s: strict 3 left grinding bodies oscillating just above it —
        // sub-8px/s residuals zero out invisibly on freeze, and free fall
        // crosses this band in <1 substep so nothing parks mid-air
        if (!b.spring && Math.hypot(b.vx, b.vy) < 8 && Math.abs(b.om) < 0.05) {
          b.calm++;
          if (b.calm >= 12) {
            b.asleep = true;
            b.vx = 0;
            b.vy = 0;
            b.om = 0;
            b.invMass = 0;
            b.invI = 0;
            continue;
          }
        } else {
          b.calm = 0;
        }
        allAsleep = false;
      }
      if (allAsleep) return; // parked — kick()/wake() restart the loop
      raf = requestAnimationFrame(loop);
    };

    // repaint/restart only — sleeping bodies stay frozen (hover lift, drag)
    const kick = () => {
      if (raf === 0) {
        last = 0;
        active = 0; // restarting from park = a fresh activity window
        raf = requestAnimationFrame(loop);
      }
    };
    // full physics wake — support or geometry changed (spawn/dismiss/resize)
    const wake = () => {
      // eslint-disable-next-line no-console
      console.log("[sediment-debug] wake() called");
      for (const b of bodiesRef.current.values()) {
        if (b.dead || b.dragging) continue;
        if (b.asleep) {
          b.asleep = false;
          b.invMass = b.baseInvMass;
          b.invI = b.baseInvI;
        }
        b.calm = 0;
        b.age = 0;
      }
      active = 0;
      kick();
    };
    wakeRef.current = wake;
    kickRef.current = kick;

    const ro = new ResizeObserver(() => {
      const rect = root.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      wake();
    });
    ro.observe(root);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      raf = -1; // wake() after teardown must not restart the loop
      ro.disconnect();
      wakeRef.current = () => {};
      kickRef.current = () => {};
    };
  }, [reduced, gravity, restitution]);

  // -------------------------------------------------------------------------
  // interaction — hover lift + timer pause, swipe-right dismissal
  // -------------------------------------------------------------------------
  const hoverIn = useCallback(
    (id: string) => {
      pauseTimer(id);
      const b = bodiesRef.current.get(id);
      if (b && !b.dead) {
        b.hovered = true;
        b.el.style.boxShadow = shadowRef.current;
        kickRef.current();
      }
    },
    [pauseTimer]
  );

  const hoverOut = useCallback(
    (id: string) => {
      resumeTimer(id);
      const b = bodiesRef.current.get(id);
      if (b && !b.dead) {
        b.hovered = false;
        b.el.style.boxShadow = restShadowRef.current;
        kickRef.current();
      }
    },
    [resumeTimer]
  );

  const beginDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      const b = bodiesRef.current.get(id);
      if (!b || b.dead) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      b.dragging = true;
      b.asleep = false;
      b.calm = 0;
      b.spring = false;
      b.dragPX = e.clientX;
      b.dragX0 = b.x;
      b.dragLastX = e.clientX;
      b.dragLastT = performance.now();
      b.dragVX = 0;
      b.invMass = 0; // kinematic while held — the pile leans on it
      b.invI = 0;
      b.vx = 0;
      b.vy = 0;
      b.om = 0;
      kickRef.current();
    },
    []
  );

  const moveDrag = useCallback((id: string, e: ReactPointerEvent<HTMLDivElement>) => {
    const b = bodiesRef.current.get(id);
    if (!b || !b.dragging || b.dead) return;
    b.x = b.dragX0 + Math.max(-24, e.clientX - b.dragPX);
    const now = performance.now();
    const dt = (now - b.dragLastT) / 1000;
    if (dt > 0.001) b.dragVX = ((e.clientX - b.dragLastX) / dt) * 0.6;
    b.dragLastX = e.clientX;
    b.dragLastT = now;
    kickRef.current();
  }, []);

  const endDrag = useCallback(
    (id: string, cancelled: boolean) => {
      const b = bodiesRef.current.get(id);
      if (!b || !b.dragging) return;
      b.dragging = false;
      b.invMass = b.baseInvMass;
      b.invI = b.baseInvI;
      const dx = b.x - b.dragX0;
      if (!cancelled && dx > 80) {
        dismiss(id);
      } else {
        // under threshold: spring back to the grab origin (k=180, ζ=0.9)
        b.spring = true;
        b.anchorX = b.dragX0;
        b.vx = b.dragVX * 0.3;
      }
      // full wake: the spring-back needs a fresh activity window, and the
      // pile may have to reflow around wherever the card was released
      wakeRef.current();
    },
    [dismiss]
  );

  if (reduced) {
    return (
      <div
        ref={containerRef}
        role="region"
        aria-label={ariaLabel}
        className={`relative overflow-y-auto ${className}`}
      >
        <div className="flex flex-col gap-2 p-3">
          {[...toasts].reverse().map((t) => (
            <ReducedCard
              key={t.id}
              toast={t}
              exiting={exiting.has(t.id)}
              onDismiss={() => dismiss(t.id)}
              onEnter={() => pauseTimer(t.id)}
              onLeave={() => resumeTimer(t.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`relative overflow-hidden ${className}`}
    >
      {/* physics frame is FLOOR_INSET px shorter than the visible box — the
          sim's floor sits above the clip line instead of exactly on it, so
          resting cards never read as clipped */}
      <div ref={containerRef} className="absolute inset-x-0 top-0" style={{ height: `calc(100% - ${FLOOR_INSET}px)` }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            ref={(el) => attach(t, el)}
            role={t.severity === "error" ? "alert" : "status"}
            onPointerDown={(e) => beginDrag(t.id, e)}
            onPointerMove={(e) => moveDrag(t.id, e)}
            onPointerUp={() => endDrag(t.id, false)}
            onPointerCancel={() => endDrag(t.id, true)}
            onPointerEnter={() => hoverIn(t.id)}
            onPointerLeave={() => hoverOut(t.id)}
            className="absolute left-0 top-0 w-64 max-w-[calc(100%-16px)] cursor-grab touch-pan-y select-none rounded-sm border border-border bg-surface transition-opacity duration-150 will-change-transform hover:border-foreground/20"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: RAIL[t.severity],
              // constant in props → React never rewrites it over the sim's
              // per-frame writes; attach() replaces it before first paint
              transform: "translate3d(-200%, -200%, 0)",
            }}
          >
            <CardInner toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
      {/* soft vignette reads the inset floor gap as intentional depth, not a
          rendering gap */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background/60 to-transparent"
      />
    </div>
  );
});
