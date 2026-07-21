"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

// DrapeMenu — a dropdown whose panel is a live verlet cloth pinned along the
// trigger's bottom edge. On open the cloth falls under gravity and drapes like
// an awning; the menu items are real DOM nodes (role=menuitem) riding
// designated vertex rows, so they sway and settle with the fabric. Cursor
// proximity billows the weave upward; close yanks every vertex back to the
// trigger on a critically damped spring and unmounts at sub-pixel rest.
// Canvas 2D underneath draws per-quad fold shading from token-derived grays.
// Direct-DOM rAF loop — no React state on the hot path, sleeps when settled.

export type DrapeMenuItem = {
  id: string;
  label: string;
  /** rendered right-aligned in font-mono, e.g. "⌘N" */
  shortcut?: string;
  icon?: ReactNode;
  /** draws a separator row above this item */
  separatorBefore?: boolean;
};

const COLS = 10;
const ROWS = 14;
const GRAVITY = 2400; // px/s²
const VERLET_DAMP = 0.99; // velocity retention per step
const RELAX_ITERS = 3; // structural-constraint relaxation passes per frame
const BILLOW_F = 900; // px/s² peak upward force at zero distance
const BILLOW_SIGMA = 60; // gaussian falloff radius, px
const BILLOW_RANGE2 = 150 * 150; // px² — beyond this the force is skipped
const SPRING_K = 120; // s⁻² — close retract stiffness
const SPRING_C = 2 * Math.sqrt(SPRING_K); // ζ = 1.0, critically damped
const SLEEP_EPS = 0.02; // px/frame — loop sleeps below this displacement
const DONE_EPS = 0.5; // px — retract unmounts below this displacement
const ARM_V = 24; // px/s — row must first exceed this to arm its entrance
const REVEAL_V = 8; // px/s — armed row reveals its label below this
const ITEM_H = 38;
const SEP_H = 13;
const PAD_TOP = 10;
const PAD_BOT = 12;
const INSET = 10; // px between cloth edge and item edge
const MARGIN_X = 80; // canvas bleed for sway/billow
const MARGIN_TOP = 16;
const MARGIN_BOT = 64;
const MAX_TILT = (6 * Math.PI) / 180; // item rotation clamp, ±6°
const DT_MAX = 0.032; // s — clamp tab-switch jumps

type Entry =
  | { kind: "item"; item: DrapeMenuItem; y0: number; h: number }
  | { kind: "sep"; y0: number; h: number };

type Sim = {
  posX: Float32Array;
  posY: Float32Array;
  prevX: Float32Array;
  prevY: Float32Array;
  velX: Float32Array;
  velY: Float32Array;
};

type Geom = { tw: number; clothW: number; dx0: number; dy0: number; dpr: number };

type RGB = [number, number, number];

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const DEFAULT_ITEMS: DrapeMenuItem[] = [
  { id: "new-project", label: "New project", shortcut: "⌘N", icon: <Glyph d="M8 3v10M3 8h10" /> },
  {
    id: "invite-member",
    label: "Invite member",
    shortcut: "⌘I",
    icon: <Glyph d="M10 13.5v-1a3 3 0 0 0-3-3H4.5a3 3 0 0 0-3 3v1M5.75 7a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5M12.5 5v4M14.5 7h-4" />,
  },
  {
    id: "switch-workspace",
    label: "Switch workspace",
    shortcut: "⌘K",
    icon: <Glyph d="M5 3 2 6l3 3M2 6h9M11 13l3-3-3-3M14 10H5" />,
  },
  {
    id: "settings",
    label: "Workspace settings",
    shortcut: "⌘,",
    separatorBefore: true,
    icon: <Glyph d="M2 5h12M10 3v4M2 11h12M6 9v4" />,
  },
  {
    id: "usage",
    label: "Usage & billing",
    icon: <Glyph d="M2 13.5h12M4 13.5v-3M8 13.5v-8M12 13.5v-5.5" />,
  },
  {
    id: "sign-out",
    label: "Sign out",
    shortcut: "⇧⌘Q",
    icon: <Glyph d="M6.5 2H3v12h3.5M10.5 11l3-3-3-3M13.5 8h-7" />,
  },
];

export function DrapeMenu({
  label = "Workspace",
  items = DEFAULT_ITEMS,
  onSelect,
  minWidth = 264,
  className = "",
}: {
  /** trigger label; also the menu's aria-label */
  label?: string;
  items?: DrapeMenuItem[];
  onSelect?: (id: string) => void;
  /** cloth/panel width floor in px (widens to match a wider trigger) */
  minWidth?: number;
  className?: string;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elsRef = useRef<(HTMLElement | null)[]>([]);

  const simRef = useRef<Sim | null>(null);
  const geomRef = useRef<Geom | null>(null);
  const phaseRef = useRef<"fall" | "retract">("fall");
  const lastDtRef = useRef(1 / 60);
  const openStartRef = useRef(0);
  const revealRef = useRef<{ armed: boolean[]; revealed: boolean[] }>({ armed: [], revealed: [] });
  const wakeRef = useRef<(() => void) | null>(null);
  const closeRef = useRef<(focusTrigger: boolean) => void>(() => {});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const reducedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { list: entries, clothH } = useMemo(() => {
    const list: Entry[] = [];
    let y = PAD_TOP;
    for (const item of items) {
      if (item.separatorBefore && list.length > 0) {
        list.push({ kind: "sep", y0: y, h: SEP_H });
        y += SEP_H;
      }
      list.push({ kind: "item", item, y0: y, h: ITEM_H });
      y += ITEM_H;
    }
    return { list, clothH: y + PAD_BOT };
  }, [items]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // clear the reduced-mode close timer on unmount
  useEffect(
    () => () => {
      if (reducedTimerRef.current) clearTimeout(reducedTimerRef.current);
    },
    []
  );

  const openMenu = () => {
    if (reducedTimerRef.current) {
      clearTimeout(reducedTimerRef.current);
      reducedTimerRef.current = null;
    }
    openStartRef.current = performance.now();
    if (!reduced && mounted && phaseRef.current === "retract") {
      // reopen mid-retract: hand spring velocities back to the verlet solver
      const s = simRef.current;
      if (s) {
        const dt = 1 / 60;
        for (let i = 0; i < s.posX.length; i++) {
          s.prevX[i] = s.posX[i] - s.velX[i] * dt;
          s.prevY[i] = s.posY[i] - s.velY[i] * dt;
        }
      }
      phaseRef.current = "fall";
      const rev = revealRef.current;
      rev.armed.fill(false);
      rev.revealed.fill(false);
      for (const el of elsRef.current) if (el) el.style.opacity = "0";
      wakeRef.current?.();
    }
    setMounted(true);
    setOpen(true);
  };

  const closeMenu = (focusTrigger: boolean) => {
    if (!open) return;
    if (reduced) {
      setOpen(false);
      reducedTimerRef.current = setTimeout(() => setMounted(false), 170);
    } else {
      const s = simRef.current;
      if (s) {
        const dt = lastDtRef.current || 1 / 60;
        for (let i = 0; i < s.posX.length; i++) {
          s.velX[i] = (s.posX[i] - s.prevX[i]) / dt;
          s.velY[i] = (s.posY[i] - s.prevY[i]) / dt;
        }
      }
      phaseRef.current = "retract";
      setOpen(false);
      for (const el of elsRef.current) if (el) el.style.opacity = "0";
      wakeRef.current?.();
    }
    if (focusTrigger) triggerRef.current?.focus();
  };
  closeRef.current = closeMenu;

  // close on outside pointerdown while mounted
  useEffect(() => {
    if (!mounted) return;
    const onDown = (e: PointerEvent) => {
      const w = wrapperRef.current;
      if (w && e.target instanceof Node && !w.contains(e.target)) closeRef.current(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [mounted]);

  // move focus to the first item once the menu opens
  useEffect(() => {
    if (!open || !mounted) return;
    const id = requestAnimationFrame(() => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].kind === "item") {
          elsRef.current[i]?.focus({ preventScroll: true });
          break;
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open, mounted, entries]);

  // -------------------------------------------------------------------------
  // cloth simulation + canvas fold shading (skipped under reduced motion)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mounted || reduced) return;
    const wrapper = wrapperRef.current;
    const trigger = triggerRef.current;
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !trigger || !overlay || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = COLS * ROWS;
    let raf = 0;
    let last = 0;
    let pActive = false;
    let pxr = 0;
    let pyr = 0;

    // token-derived draw colors — re-derived live on documentElement class flips
    let col = {
      surface: [23, 23, 23] as RGB,
      border: [46, 46, 46] as RGB,
      lighter: [237, 237, 237] as RGB,
      darker: [10, 10, 10] as RGB,
    };
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const read = (name: string, fb: string): RGB => {
        const raw = cs.getPropertyValue(name).trim();
        ctx.fillStyle = fb;
        if (raw) ctx.fillStyle = raw; // canvas normalizes any CSS color format
        const v = String(ctx.fillStyle);
        if (v.charAt(0) === "#" && v.length >= 7) {
          return [
            parseInt(v.slice(1, 3), 16),
            parseInt(v.slice(3, 5), 16),
            parseInt(v.slice(5, 7), 16),
          ];
        }
        const m = v.match(/[\d.]+/g);
        if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
        return [23, 23, 23];
      };
      const surface = read("--surface", "#171717");
      const border = read("--border", "#2e2e2e");
      const fg = read("--foreground", "#ededed");
      const bg = read("--background", "#0a0a0a");
      const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      // sheen goes toward whichever ink is lighter, shadow toward the darker —
      // fold shading stays visible on both themes without hardcoded hexes
      const fgLighter = lum(fg) >= lum(bg);
      col = {
        surface,
        border,
        lighter: fgLighter ? fg : bg,
        darker: fgLighter ? bg : fg,
      };
    };
    const mix = (a: RGB, b: RGB, t: number) =>
      `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(
        a[2] + (b[2] - a[2]) * t
      )})`;
    const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    const measure = (): boolean => {
      const tRect = trigger.getBoundingClientRect();
      if (tRect.width < 2 || tRect.height < 2) return false; // zero-size guard
      const clothW = Math.max(minWidth, Math.round(tRect.width));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = clothW + MARGIN_X * 2;
      const ch = clothH + MARGIN_TOP + MARGIN_BOT;
      canvas.width = Math.max(1, Math.round(cw * dpr));
      canvas.height = Math.max(1, Math.round(ch * dpr));
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      geomRef.current = {
        tw: tRect.width,
        clothW,
        dx0: clothW / (COLS - 1),
        dy0: clothH / (ROWS - 1),
        dpr,
      };
      const itemW = clothW - INSET * 2;
      for (const el of elsRef.current) if (el) el.style.width = `${itemW}px`;
      return true;
    };
    if (!measure()) return;

    // vertices start compressed at the trigger's bottom edge, then fall free
    const initCloth = () => {
      const g = geomRef.current;
      if (!g) return;
      const sim: Sim = {
        posX: new Float32Array(N),
        posY: new Float32Array(N),
        prevX: new Float32Array(N),
        prevY: new Float32Array(N),
        velX: new Float32Array(N),
        velY: new Float32Array(N),
      };
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          sim.posX[i] = c * g.dx0;
          // fraction of rest length, not an absolute px start: the prior fixed
          // `r * 1.5` compressed rows to ~1/13th of dy0, which this solver's
          // 3-iteration relax can't recover from and folds into a stuck ~14px
          // clump instead of draping (reproduced with a plain click). 0.5 keeps
          // the compressed-then-falls look inside the solver's convergence basin.
          sim.posY[i] = r * g.dy0 * 0.5;
          sim.prevX[i] = sim.posX[i];
          sim.prevY[i] = sim.posY[i];
        }
      }
      simRef.current = sim;
    };
    initCloth();
    phaseRef.current = "fall";
    revealRef.current = {
      armed: new Array<boolean>(entries.length).fill(false),
      revealed: new Array<boolean>(entries.length).fill(false),
    };
    derive();

    const A = { x: 0, y: 0 };
    const B = { x: 0, y: 0 };
    const C = { x: 0, y: 0 };
    const D = { x: 0, y: 0 };

    const sampleInto = (
      X: Float32Array,
      Y: Float32Array,
      u: number,
      v: number,
      out: { x: number; y: number }
    ) => {
      const cf = u * (COLS - 1);
      const rf = v * (ROWS - 1);
      let c0 = Math.floor(cf);
      let r0 = Math.floor(rf);
      if (c0 < 0) c0 = 0;
      else if (c0 > COLS - 2) c0 = COLS - 2;
      if (r0 < 0) r0 = 0;
      else if (r0 > ROWS - 2) r0 = ROWS - 2;
      let fx = cf - c0;
      let fy = rf - r0;
      if (fx < 0) fx = 0;
      else if (fx > 1) fx = 1;
      if (fy < 0) fy = 0;
      else if (fy > 1) fy = 1;
      const i00 = r0 * COLS + c0;
      const i01 = i00 + COLS;
      const x0 = X[i00] + (X[i00 + 1] - X[i00]) * fx;
      const x1 = X[i01] + (X[i01 + 1] - X[i01]) * fx;
      const y0 = Y[i00] + (Y[i00 + 1] - Y[i00]) * fx;
      const y1 = Y[i01] + (Y[i01 + 1] - Y[i01]) * fx;
      out.x = x0 + (x1 - x0) * fy;
      out.y = y0 + (y1 - y0) * fy;
    };

    const updateEntries = (dt: number, now: number) => {
      const g = geomRef.current;
      const s = simRef.current;
      if (!g || !s) return;
      const uL = INSET / g.clothW;
      const uR = 1 - uL;
      const rev = revealRef.current;
      const falling = phaseRef.current === "fall";
      for (let i = 0; i < entries.length; i++) {
        const el = elsRef.current[i];
        if (!el) continue;
        const en = entries[i];
        const v = (en.y0 + en.h / 2) / clothH;
        sampleInto(s.posX, s.posY, uL, v, A);
        sampleInto(s.posX, s.posY, uR, v, B);
        let ang = Math.atan2(B.y - A.y, B.x - A.x);
        if (ang > MAX_TILT) ang = MAX_TILT;
        else if (ang < -MAX_TILT) ang = -MAX_TILT;
        el.style.transform = `translate3d(${A.x.toFixed(2)}px, ${(A.y - en.h / 2).toFixed(
          2
        )}px, 0) rotate(${ang.toFixed(4)}rad)`;
        if (falling && !rev.revealed[i]) {
          // label fades in once its anchor row's vertical velocity settles
          sampleInto(s.posX, s.posY, 0.5, v, C);
          sampleInto(s.prevX, s.prevY, 0.5, v, D);
          const vy = Math.abs(C.y - D.y) / dt;
          if (vy > ARM_V) rev.armed[i] = true;
          if ((rev.armed[i] && vy < REVEAL_V) || now - openStartRef.current > 900) {
            rev.revealed[i] = true;
            el.style.opacity = "1";
          }
        }
      }
    };

    const draw = () => {
      const g = geomRef.current;
      const s = simRef.current;
      if (!g || !s) return;
      const { posX, posY } = s;
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / g.dpr, canvas.height / g.dpr);
      ctx.translate(MARGIN_X, MARGIN_TOP);
      ctx.lineJoin = "round";
      // per-quad fold shading: brightness from horizontal stretch (taut =
      // sheen toward the lighter ink) and lateral lean (fold shadow toward
      // the darker ink) — a cheap vertex-normal approximation
      for (let r = 0; r < ROWS - 1; r++) {
        for (let c = 0; c < COLS - 1; c++) {
          const i00 = r * COLS + c;
          const i10 = i00 + 1;
          const i01 = i00 + COLS;
          const i11 = i01 + 1;
          const ex =
            (Math.hypot(posX[i10] - posX[i00], posY[i10] - posY[i00]) +
              Math.hypot(posX[i11] - posX[i01], posY[i11] - posY[i01])) /
            (2 * g.dx0);
          const lean = (posX[i01] - posX[i00] + (posX[i11] - posX[i10])) / (2 * g.dy0);
          let sh = 2.4 * (ex - 1) + 1.1 * lean;
          if (sh > 1) sh = 1;
          else if (sh < -1) sh = -1;
          const fill =
            sh >= 0
              ? mix(col.surface, col.lighter, 0.06 + 0.3 * sh)
              : mix(col.surface, col.darker, 0.05 + 0.32 * -sh);
          ctx.beginPath();
          ctx.moveTo(posX[i00], posY[i00]);
          ctx.lineTo(posX[i10], posY[i10]);
          ctx.lineTo(posX[i11], posY[i11]);
          ctx.lineTo(posX[i01], posY[i01]);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = fill; // 1px self-stroke kills seams between quads
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      // weave ribs
      ctx.strokeStyle = rgba(col.border, 0.45);
      ctx.lineWidth = 1;
      for (let r = 1; r < ROWS - 1; r++) {
        ctx.beginPath();
        ctx.moveTo(posX[r * COLS], posY[r * COLS]);
        for (let c = 1; c < COLS; c++) ctx.lineTo(posX[r * COLS + c], posY[r * COLS + c]);
        ctx.stroke();
      }
      // hem
      ctx.strokeStyle = rgba(col.border, 0.9);
      ctx.beginPath();
      ctx.moveTo(posX[0], posY[0]);
      for (let c = 1; c < COLS; c++) ctx.lineTo(posX[c], posY[c]);
      for (let r = 1; r < ROWS; r++) ctx.lineTo(posX[r * COLS + COLS - 1], posY[r * COLS + COLS - 1]);
      for (let c = COLS - 2; c >= 0; c--)
        ctx.lineTo(posX[(ROWS - 1) * COLS + c], posY[(ROWS - 1) * COLS + c]);
      for (let r = ROWS - 2; r > 0; r--) ctx.lineTo(posX[r * COLS], posY[r * COLS]);
      ctx.closePath();
      ctx.stroke();
    };

    const relax = (s: Sim, i: number, j: number, rest: number) => {
      const dx = s.posX[j] - s.posX[i];
      const dy = s.posY[j] - s.posY[i];
      const dist = Math.hypot(dx, dy);
      if (dist < 1e-6) return; // degenerate-pair guard
      const f = ((dist - rest) / dist) * 0.5;
      const ox = dx * f;
      const oy = dy * f;
      s.posX[i] += ox;
      s.posY[i] += oy;
      s.posX[j] -= ox;
      s.posY[j] -= oy;
    };

    const finishClose = () => {
      simRef.current = null;
      phaseRef.current = "fall";
      setMounted(false);
    };

    const loop = (now: number) => {
      raf = 0;
      const g = geomRef.current;
      const s = simRef.current;
      if (!g || !s) return;
      const dt = last === 0 ? 1 / 60 : Math.min(DT_MAX, Math.max(0.001, (now - last) / 1000));
      last = now;
      lastDtRef.current = dt;
      let sleep = false;

      if (phaseRef.current === "fall") {
        // verlet step: gravity + gaussian cursor billow, 0.99 damping/step
        const dt2 = dt * dt;
        for (let i = COLS; i < N; i++) {
          const x = s.posX[i];
          const y = s.posY[i];
          let ay = GRAVITY;
          if (pActive) {
            const ddx = x - pxr;
            const ddy = y - pyr;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < BILLOW_RANGE2)
              ay -= BILLOW_F * Math.exp(-d2 / (2 * BILLOW_SIGMA * BILLOW_SIGMA));
          }
          s.posX[i] = x + (x - s.prevX[i]) * VERLET_DAMP;
          s.posY[i] = y + (y - s.prevY[i]) * VERLET_DAMP + ay * dt2;
          s.prevX[i] = x;
          s.prevY[i] = y;
        }
        for (let it = 0; it < RELAX_ITERS; it++) {
          for (let r = 0; r < ROWS; r++) {
            const row = r * COLS;
            for (let c = 0; c < COLS - 1; c++) relax(s, row + c, row + c + 1, g.dx0);
          }
          for (let r = 0; r < ROWS - 1; r++) {
            for (let c = 0; c < COLS; c++) relax(s, r * COLS + c, (r + 1) * COLS + c, g.dy0);
          }
          // re-pin the top row along the trigger's bottom edge
          for (let c = 0; c < COLS; c++) {
            s.posX[c] = c * g.dx0;
            s.posY[c] = 0;
            s.prevX[c] = s.posX[c];
            s.prevY[c] = 0;
          }
        }
        let maxDp = 0;
        for (let i = COLS; i < N; i++) {
          const dpx = Math.abs(s.posX[i] - s.prevX[i]);
          const dpy = Math.abs(s.posY[i] - s.prevY[i]);
          if (dpx > maxDp) maxDp = dpx;
          if (dpy > maxDp) maxDp = dpy;
        }
        updateEntries(dt, now);
        draw();
        if (maxDp < SLEEP_EPS) sleep = true;
      } else {
        // retract: every vertex on a critically damped spring to the trigger
        const tx = g.tw / 2;
        let maxDisp = 0;
        for (let i = 0; i < N; i++) {
          let vx = s.velX[i];
          let vy = s.velY[i];
          vx += (-SPRING_K * (s.posX[i] - tx) - SPRING_C * vx) * dt;
          vy += (-SPRING_K * s.posY[i] - SPRING_C * vy) * dt;
          s.velX[i] = vx;
          s.velY[i] = vy;
          s.posX[i] += vx * dt;
          s.posY[i] += vy * dt;
          s.prevX[i] = s.posX[i];
          s.prevY[i] = s.posY[i];
          const dx = Math.abs(s.posX[i] - tx);
          const dy = Math.abs(s.posY[i]);
          if (dx > maxDisp) maxDisp = dx;
          if (dy > maxDisp) maxDisp = dy;
        }
        updateEntries(dt, now);
        draw();
        if (maxDisp < DONE_EPS) {
          finishClose();
          return;
        }
      }

      if (sleep) last = 0;
      else raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    wakeRef.current = wake;
    wake();

    const onMove = (e: PointerEvent) => {
      const oRect = overlay.getBoundingClientRect();
      pxr = e.clientX - oRect.left;
      pyr = e.clientY - oRect.top;
      pActive = true;
      wake();
    };
    const onLeave = () => {
      pActive = false;
      wake();
    };
    wrapper.addEventListener("pointermove", onMove);
    wrapper.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => {
      if (measure()) wake();
    });
    ro.observe(trigger);

    const mo = new MutationObserver(() => {
      derive();
      wake();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      wakeRef.current = null;
      ro.disconnect();
      mo.disconnect();
      wrapper.removeEventListener("pointermove", onMove);
      wrapper.removeEventListener("pointerleave", onLeave);
    };
  }, [mounted, reduced, entries, clothH, minWidth]);

  // -------------------------------------------------------------------------
  // keyboard menu semantics
  // -------------------------------------------------------------------------
  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const btns: HTMLElement[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].kind === "item") {
        const el = elsRef.current[i];
        if (el) btns.push(el);
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
      return;
    }
    if (e.key === "Tab") {
      closeMenu(false);
      return;
    }
    if (btns.length === 0) return;
    const idx = btns.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (idx + 1) % btns.length;
    else if (e.key === "ArrowUp") next = idx < 0 ? btns.length - 1 : (idx - 1 + btns.length) % btns.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = btns.length - 1;
    if (next >= 0) {
      e.preventDefault();
      btns[next].focus({ preventScroll: true });
    }
  };

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openMenu();
    } else if (open && e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    }
  };

  const select = (id: string) => {
    onSelectRef.current?.(id);
    closeMenu(true);
  };

  const setEl = (i: number) => (el: HTMLElement | null) => {
    elsRef.current[i] = el;
  };

  const itemClass =
    "group flex items-center gap-2.5 rounded-sm px-3 text-left text-sm text-foreground outline-none " +
    "hover:bg-surface focus-visible:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
  const rail = (
    <span
      aria-hidden
      className="absolute bottom-[7px] left-0 top-[7px] w-0.5 rounded-full bg-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    />
  );

  const itemInner = (item: DrapeMenuItem) => (
    <>
      {rail}
      {item.icon && (
        <span className="shrink-0 text-muted transition-colors duration-150 group-hover:text-foreground group-focus-visible:text-foreground">
          {item.icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.shortcut && <span className="shrink-0 font-mono text-xs text-muted">{item.shortcut}</span>}
    </>
  );

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={mounted ? menuId : undefined}
        onClick={() => (open ? closeMenu(true) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {label}
        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {mounted && !reduced && (
        <div ref={overlayRef} className="absolute left-0 top-full z-50">
          <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none absolute"
            style={{ left: -MARGIN_X, top: -MARGIN_TOP }}
          />
          <div
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            className="relative"
          >
            {entries.map((en, i) =>
              en.kind === "sep" ? (
                <div
                  key={`sep-${i}`}
                  ref={setEl(i)}
                  role="separator"
                  aria-orientation="horizontal"
                  className="absolute left-0 top-0 flex items-center px-2.5 will-change-transform"
                  style={{
                    height: SEP_H,
                    opacity: 0,
                    transition: "opacity 120ms linear",
                    transformOrigin: "0 50%",
                  }}
                >
                  <span className="h-px w-full bg-border" />
                </div>
              ) : (
                <button
                  key={en.item.id}
                  ref={setEl(i)}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => select(en.item.id)}
                  className={`absolute left-0 top-0 will-change-transform ${itemClass}`}
                  style={{
                    height: ITEM_H,
                    opacity: 0,
                    transition: "opacity 120ms linear",
                    transformOrigin: "0 50%",
                  }}
                >
                  {itemInner(en.item)}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {mounted && reduced && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          data-state={open ? "open" : "closed"}
          className="absolute left-0 top-full z-50 mt-2 origin-top rounded-md border border-border bg-surface p-1.5 shadow-lg transition-[opacity,transform] duration-150 data-[state=closed]:pointer-events-none data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0"
          style={{ width: minWidth, animation: "ns-drape-in 150ms ease-out" }}
        >
          {entries.map((en, i) =>
            en.kind === "sep" ? (
              <div
                key={`sep-${i}`}
                role="separator"
                aria-orientation="horizontal"
                className="mx-1 my-1.5 h-px bg-border"
              />
            ) : (
              <button
                key={en.item.id}
                ref={setEl(i)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => select(en.item.id)}
                className={`relative w-full py-2 ${itemClass}`}
              >
                {itemInner(en.item)}
              </button>
            )
          )}
        </div>
      )}

      <style>{`@keyframes ns-drape-in{from{opacity:0;transform:scale(.98)}}`}</style>
    </div>
  );
}
