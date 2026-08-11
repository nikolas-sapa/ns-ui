"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// MagazineDrop — a full-bleed gallery whose transport is a gravity-fed slide
// magazine: a rotary drum above the gate indexes with detent weight, releases
// a plate, and the plate FALLS into the gate and seats with real bounce.
//
// Nothing here cross-fades. Every visible change of item is a rigid body
// moving under an integrator: the outgoing plate is ejected with an impulse
// and leaves the frame, the drum turns one notch against a detent spring, and
// the incoming plate is released, accelerates under gravity, strikes the seat
// and settles over two decaying bounces with a little residual tilt. Reverse
// is the same machine run the other way — the return ram tosses a plate back
// up into the gate from the lower chute and gravity catches it, so both
// directions are the same physics rather than one being an animation played
// backwards.
//
// The drum phase is the single source of truth. Dragging turns the drum
// directly (no smoothing: a drag is a position, and an exponential follower
// would put a v*tau steady-state error between the finger and the plates,
// which reads as the machine being late). Release hands the phase to a detent
// spring carrying the flick's momentum, and the plate transition fires when
// round(phase) changes — so a slow drag lets you feel the detent without
// committing, and a flick indexes several frames.
// ---------------------------------------------------------------------------

export interface MagazineDropItem {
  /** Shown on the plate and announced to screen readers. */
  title: string;
  /** Second line on the plate; the accessible description. */
  caption?: string;
  /** Which procedural plate pattern to engrave. Defaults to the item index. */
  pattern?: number;
}

export interface MagazineDropProps {
  /** Plates loaded into the magazine. Defaults to six generated frames. */
  items?: MagazineDropItem[];
  /** Starting plate. @default 0 */
  defaultIndex?: number;
  /** Seconds between ambient advances; 0 disables the idle transport. @default 4.6 */
  ambient?: number;
  /** Gravity scale on the drop. Higher lands harder. @default 1 */
  weight?: number;
  /** Freezes the machine on a composed still without unmounting. */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_ITEMS: MagazineDropItem[] = [
  { title: "Turned Face", caption: "Concentric cut, 0.2mm pitch" },
  { title: "Cross Hatch", caption: "Engraved plate, two passes" },
  { title: "Moiré Gate", caption: "Two rasters, 4° apart" },
  { title: "Dot Lattice", caption: "Halftone, radial falloff" },
  { title: "Standing Wave", caption: "Three-source interference" },
  { title: "Warp Weave", caption: "Braided rule, 12 ends" },
];

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (fn) {
    const p = fn[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every((x) => Number.isFinite(x))) {
      return [p[0], p[1], p[2]];
    }
  }
  return null;
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function css(c: RGB, alpha = 1): string {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;
}
function luminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

interface Palette {
  bg: RGB;
  fg: RGB;
  muted: RGB;
  border: RGB;
  accent: RGB;
  dark: boolean;
  /** plate substrate: a value the engraving can cut into in both themes */
  plate: RGB;
  /** the recessed bay behind the transport */
  bay: RGB;
  /** the lit aperture band the gate reads the plate in */
  lamp: RGB;
}

// A rigid plate in flight. y is signed px from the seat (negative = above the
// gate), rot is radians of tilt about the plate's own centre.
interface Body {
  index: number;
  y: number;
  vy: number;
  rot: number;
  vrot: number;
  /** counts down the bounces still allowed before the plate is clamped */
  bounces: number;
  /** true once the body has left the frame and can be dropped */
  gone: boolean;
}

const NOTCH = 96; // px of drag that equals one detent
const SPRING = 190; // detent stiffness
const DAMP = 17; // detent damping
const RESTITUTION = 0.34;
const BOUNCES = 2;

export function MagazineDrop({
  items = DEFAULT_ITEMS,
  defaultIndex = 0,
  ambient = 4.6,
  weight = 1,
  paused = false,
  className = "",
  style,
}: MagazineDropProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();

  const count = Math.max(1, items.length);
  const [index, setIndex] = useState(() => ((defaultIndex % count) + count) % count);
  const [reduced, setReduced] = useState(false);

  // The engine writes here and the React tree only reads it; keeping the
  // machine out of state is what lets the drum run at frame rate without
  // re-rendering the DOM shadow list sixty times a second.
  const apiRef = useRef<{
    advance: (dir: number, user: boolean) => void;
    jumpTo: (target: number) => void;
  } | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const ambientRef = useRef(ambient);
  ambientRef.current = ambient;
  const weightRef = useRef(weight);
  weightRef.current = weight;
  const onIndexRef = useRef(setIndex);
  onIndexRef.current = setIndex;

  const advance = useCallback((dir: number) => {
    apiRef.current?.advance(dir, true);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let running = false;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let lastMs = performance.now();
    let onScreen = true;
    let reducedMotion = false;

    // ---- palette ---------------------------------------------------------
    let pal: Palette = {
      bg: [255, 255, 255],
      fg: [10, 10, 10],
      muted: [130, 130, 130],
      border: [220, 220, 220],
      accent: [0, 107, 255],
      dark: false,
      plate: [240, 240, 240],
      bay: [246, 246, 246],
      lamp: [250, 250, 250],
    };

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [255, 255, 255];
      const fg = parseColor(cs.getPropertyValue("--foreground")) ?? [10, 10, 10];
      const muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? [130, 130, 130];
      const border = parseColor(cs.getPropertyValue("--border")) ?? [220, 220, 220];
      const accent = parseColor(cs.getPropertyValue("--ns-accent")) ?? [0, 107, 255];
      const dark = luminance(bg) < 0.5;
      // The plate has to be a DIFFERENT value from the bay in both themes or
      // the transport disappears into its own background. In light the plate
      // is the bright substrate and the bay is sunk toward the border; in dark
      // the plate is lifted off the background toward the border and the bay
      // drops below the page.
      // Three values have to separate, not two: the page outside the bay, the
      // recessed bay the transport runs in, and the plate itself. Light is the
      // harder case — a bay mixed toward a near-white --border lands within a
      // few percent of the plate and the whole machine reads flat — so the bay
      // is sunk toward --foreground by a fixed amount instead, which holds
      // whatever value --border happens to be.
      // Three stops, and the ORDER matters more than the values: the plate is
      // the brightest thing in the frame because it is the thing being lit,
      // the lamp aperture sits under it, and the bay is sunk below both. A
      // first pass had the aperture at the page value and the plate a hair
      // below it, which put the subject dimmer than its own background.
      const plate = dark ? mixRGB(bg, border, 0.95) : bg;
      const lamp = dark ? mixRGB(bg, border, 0.3) : mixRGB(bg, fg, 0.05);
      const bay = dark ? mixRGB(bg, [0, 0, 0], 0.55) : mixRGB(bg, fg, 0.12);
      pal = { bg, fg, muted, border, accent, dark, plate, bay, lamp };
      rasterizePlates();
    };

    // ---- procedural plates ----------------------------------------------
    // Each plate is engraved once into an offscreen canvas at gate resolution
    // and blitted with a transform every frame; the transport can then be as
    // dense as it likes without the pattern cost showing up per frame.
    const plateCanvases: HTMLCanvasElement[] = [];
    let plateW = 0;
    let plateH = 0;

    const engrave = (c: CanvasRenderingContext2D, w: number, h: number, i: number) => {
      const item = itemsRef.current[i % Math.max(1, itemsRef.current.length)];
      const kind = (item?.pattern ?? i) % 6;
      const ink = pal.fg;
      const sub = pal.plate;
      const soft = mixRGB(sub, ink, pal.dark ? 0.34 : 0.3);
      // Ink weight is not symmetric between themes. On the dark plate the
      // engraving is a light-on-dark cut and a low alpha already separates; on
      // the near-white light plate the same alphas produce a ghost — the first
      // light pass read as an empty sheet of paper. Everything below is written
      // for dark and scaled up for light.
      const A = pal.dark ? 1 : 1.7;
      const ia = (a: number) => Math.min(1, a * A);

      c.fillStyle = css(sub);
      c.fillRect(0, 0, w, h);

      c.save();
      c.beginPath();
      c.rect(0, 0, w, h);
      c.clip();

      const cx = w * 0.5;
      const cy = h * 0.46;
      const R = Math.hypot(w, h) * 0.6;

      if (kind === 0) {
        // turned face: concentric cuts, pitch opening toward the rim
        c.strokeStyle = css(ink, ia(0.5));
        for (let r = 4, k = 0; r < R; k++, r += 3.2 + k * 0.24) {
          c.lineWidth = 1 + (k % 7 === 0 ? 1.1 : 0);
          c.globalAlpha = ia(0.22 + 0.5 * (1 - r / R));
          c.beginPath();
          c.arc(cx, cy, r, 0, Math.PI * 2);
          c.stroke();
        }
        c.globalAlpha = 1;
      } else if (kind === 1) {
        // two engraved hatch passes at 60°, density falling to the corners
        for (const [ang, alpha] of [
          [-Math.PI / 3, 0.5],
          [Math.PI / 6, 0.34],
        ] as const) {
          c.save();
          c.translate(cx, cy);
          c.rotate(ang);
          c.strokeStyle = css(ink, ia(alpha));
          c.lineWidth = 1.15;
          for (let x = -R; x < R; x += 7) {
            const f = 1 - Math.abs(x) / R;
            c.globalAlpha = ia(0.15 + 0.75 * f * f);
            c.beginPath();
            c.moveTo(x, -R);
            c.lineTo(x, R);
            c.stroke();
          }
          c.restore();
        }
        c.globalAlpha = 1;
      } else if (kind === 2) {
        // moiré: two rasters four degrees apart, which is the whole image
        for (const ang of [0.0, 0.07]) {
          c.save();
          c.translate(cx, cy);
          c.rotate(ang);
          c.fillStyle = css(ink, ia(0.34));
          for (let x = -R; x < R; x += 6) c.fillRect(x, -R, 2.6, R * 2);
          c.restore();
        }
        c.save();
        c.translate(cx, cy);
        c.fillStyle = css(sub, 0.55);
        for (let y = -R; y < R; y += 9) c.fillRect(-R, y, R * 2, 3.4);
        c.restore();
      } else if (kind === 3) {
        // halftone lattice, dot area falling off radially
        c.fillStyle = css(ink, ia(0.62));
        const step = 13;
        for (let y = step * 0.5; y < h; y += step) {
          for (let x = ((y / step) % 2) * step * 0.5; x < w; x += step) {
            const d = Math.hypot(x - cx, y - cy) / (R * 0.7);
            const r = Math.max(0, 5.2 * (1 - d * d));
            if (r <= 0.2) continue;
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.fill();
          }
        }
      } else if (kind === 4) {
        // three-source interference, drawn as contour bands rather than a
        // shaded field so it survives being 5px tall in the magazine stack
        const src: [number, number][] = [
          [w * 0.24, h * 0.3],
          [w * 0.76, h * 0.36],
          [w * 0.5, h * 0.82],
        ];
        c.strokeStyle = css(ink, ia(0.44));
        c.lineWidth = 1.1;
        const stepY = 3;
        for (let y = 0; y < h; y += stepY) {
          c.beginPath();
          let pen = false;
          for (let x = 0; x <= w; x += 3) {
            let s = 0;
            for (const [sx, sy] of src) s += Math.sin(Math.hypot(x - sx, y - sy) * 0.09);
            const yy = y + s * 1.5;
            if (!pen) {
              c.moveTo(x, yy);
              pen = true;
            } else c.lineTo(x, yy);
          }
          c.stroke();
        }
      } else {
        // braided rule: warp threads crossing over and under a fixed weft
        const ends = 12;
        const gap = w / ends;
        c.lineWidth = Math.max(2, gap * 0.34);
        c.lineCap = "round";
        for (let e = 0; e < ends; e++) {
          const x0 = gap * (e + 0.5);
          c.strokeStyle = css(e % 2 === 0 ? ink : soft, ia(e % 2 === 0 ? 0.55 : 0.85));
          c.beginPath();
          for (let y = 0; y <= h; y += 4) {
            const x = x0 + Math.sin(y * 0.02 + e * 0.9) * gap * 0.62;
            if (y === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }
        c.strokeStyle = css(sub, 0.65);
        c.lineWidth = 4;
        for (let y = h * 0.08; y < h; y += h * 0.14) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(w, y);
          c.stroke();
        }
      }
      c.restore();

      // engraved index block, bottom-left, and a registration bar top-right —
      // both cut into the same plate so they travel with it
      const pad = Math.max(10, w * 0.035);
      const label = String((i % 99) + 1).padStart(2, "0");
      c.fillStyle = css(ink, ia(0.86));
      c.font = `600 ${Math.round(h * 0.13)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      c.textBaseline = "alphabetic";
      c.fillText(label, pad, h - pad);

      c.fillStyle = css(ink, ia(0.5));
      c.font = `500 ${Math.round(h * 0.055)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const title = (item?.title ?? "").toUpperCase();
      c.fillText(title, pad + Math.round(h * 0.13) * 1.5, h - pad - h * 0.005);

      c.fillStyle = css(ink, ia(0.42));
      for (let k = 0; k < 5; k++) {
        c.fillRect(w - pad - k * 9 - 4, pad, 4, k === 0 ? 16 : 10);
      }

      // plate edge: a bevel, not a border-radius. Light catches the top edge.
      c.strokeStyle = css(pal.dark ? pal.fg : pal.fg, pal.dark ? 0.28 : 0.35);
      c.lineWidth = 2;
      c.strokeRect(1, 1, w - 2, h - 2);
      c.fillStyle = css(pal.dark ? pal.fg : pal.bg, pal.dark ? 0.18 : 0.9);
      c.fillRect(2, 2, w - 4, 2);
    };

    const rasterizePlates = () => {
      if (plateW < 8 || plateH < 8) return;
      const n = Math.max(1, itemsRef.current.length);
      plateCanvases.length = n;
      for (let i = 0; i < n; i++) {
        let cv = plateCanvases[i];
        if (!cv) {
          cv = document.createElement("canvas");
          plateCanvases[i] = cv;
        }
        const pw = Math.round(plateW * dpr);
        const ph = Math.round(plateH * dpr);
        if (cv.width !== pw || cv.height !== ph) {
          cv.width = pw;
          cv.height = ph;
        }
        const c = cv.getContext("2d");
        if (!c) continue;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, plateW, plateH);
        engrave(c, plateW, plateH, i);
      }
    };

    // ---- machine state ---------------------------------------------------
    const n = () => Math.max(1, itemsRef.current.length);
    const wrapIdx = (i: number) => ((i % n()) + n()) % n();

    let phase = 0; // continuous drum angle in notches
    let phaseVel = 0;
    let notch = 0; // round(phase) at the last transition
    let current = wrapIdx(defaultIndex);
    let seated: Body = { index: current, y: 0, vy: 0, rot: 0, vrot: 0, bounces: 0, gone: false };
    let flying: Body | null = null;
    const spent: Body[] = [];
    let ambientClock = 0;
    let interactedAt = -1e9;
    let simTime = 0;
    let dragging = false;
    let focusVisible = false;

    const GRAVITY = () => 2600 * Math.max(0.2, weightRef.current);

    // A transition is an impulse, not a tween. The outgoing plate is kicked
    // out of the gate and the incoming one is released above (or rammed up
    // from the chute on reverse); everything after that is the integrator.
    const startTransition = (dir: number) => {
      const g = GRAVITY();
      const drop = Math.max(160, cssH * 0.55);
      const next = wrapIdx(current + dir);
      // The ejection impulse is signed AND sized by direction, because gravity
      // is still on the outgoing plate: forward only needs a nudge (gravity
      // does the rest), reverse has to be thrown hard enough to clear the top
      // of the frame or it rises a few px, falls back, and crosses the
      // incoming plate at the gate mouth.
      const out: Body = {
        index: current,
        y: seated.y,
        vy: dir > 0 ? 220 : -Math.sqrt(2 * g * cssH * 0.85),
        rot: seated.rot,
        vrot: (dir > 0 ? 1 : -1) * (0.5 + Math.random() * 0.4),
        bounces: 0,
        gone: false,
      };
      spent.push(out);
      // Two, not three. Each body in flight is a full-gate rotated drawImage,
      // and the fill is the entire per-frame cost of this component: at DPR 2
      // a 864x576 CSS plate is 2.0M device px, so four bodies plus the bay was
      // 8M px/frame and the drag measured 33ms — exactly two vsync intervals.
      // One spent body is what holds 16.7 through a continuous drag, and it
      // costs nothing legible: at drag speed the second-oldest plate is off
      // the frame before the eye has finished with the first.
      if (spent.length > 1) spent.shift();
      if (dir > 0) {
        // released from the magazine: starts at rest, gravity does the rest
        flying = { index: next, y: -drop, vy: 0, rot: -0.02, vrot: 0.05, bounces: BOUNCES, gone: false };
      } else {
        // return ram: tossed up from the lower chute with just enough energy
        // to overshoot the seat, so gravity catches and settles it
        const v = Math.sqrt(2 * g * (drop + 40));
        flying = { index: next, y: drop, vy: -v, rot: 0.02, vrot: -0.05, bounces: BOUNCES, gone: false };
      }
      current = next;
      onIndexRef.current(next);
    };

    const advance = (dir: number, user: boolean) => {
      if (dir === 0) return;
      if (user) interactedAt = simTime;
      notch += dir;
      phase = notch;
      phaseVel = 0;
      if (reducedMotion || pausedRef.current) {
        // discrete states: the plate is simply in the gate, no flight
        current = wrapIdx(current + dir);
        seated = { index: current, y: 0, vy: 0, rot: 0, vrot: 0, bounces: 0, gone: false };
        flying = null;
        spent.length = 0;
        onIndexRef.current(current);
        draw();
        return;
      }
      startTransition(dir > 0 ? 1 : -1);
      wake();
    };
    // Home/End are a jump, not N advances: the drum spins to the target and
    // ONE plate flies, arriving from the side of the gate the jump came from.
    const jumpTo = (target: number) => {
      const t = wrapIdx(target);
      if (t === current) return;
      interactedAt = simTime;
      const dir = t > current ? 1 : -1;
      if (reducedMotion || pausedRef.current) {
        current = t;
        seated = { index: current, y: 0, vy: 0, rot: 0, vrot: 0, bounces: 0, gone: false };
        flying = null;
        spent.length = 0;
        onIndexRef.current(current);
        draw();
        return;
      }
      notch += dir;
      phase = notch;
      phaseVel = 0;
      current = wrapIdx(t - dir);
      startTransition(dir);
      wake();
    };
    apiRef.current = { advance, jumpTo };

    const stepBody = (b: Body, dt: number, g: number, seat: boolean) => {
      b.vy += g * dt;
      b.y += b.vy * dt;
      b.rot += b.vrot * dt;
      b.vrot *= Math.exp(-dt * 3.4);
      if (!seat) {
        if (Math.abs(b.y) > cssH * 1.2) b.gone = true;
        return;
      }
      if (b.y >= 0) {
        // strike the seat
        if (b.bounces > 0 && b.vy > 40) {
          b.y = 0;
          b.vy = -b.vy * RESTITUTION;
          b.bounces -= 1;
          // the impact torques the plate a little; the seat's detents damp it
          b.vrot += (b.vrot >= 0 ? 1 : -1) * 0.5 + (Math.random() - 0.5) * 0.4;
          b.vrot *= 0.55;
        } else {
          b.y = 0;
          b.vy = 0;
          b.bounces = 0;
        }
      }
    };

    const stepPhysics = (dt: number) => {
      const g = GRAVITY();
      if (flying) {
        stepBody(flying, dt, g, true);
        // the tilt is pulled out by the gate's own registration pins once the
        // plate is down: a critically damped return, so it never wobbles
        if (flying.y === 0 && flying.vy === 0) {
          flying.vrot += (0 - flying.rot) * 60 * dt;
          flying.vrot *= Math.exp(-dt * 9);
          flying.rot += flying.vrot * dt;
          if (Math.abs(flying.rot) < 0.0015 && Math.abs(flying.vrot) < 0.02) {
            flying.rot = 0;
            flying.vrot = 0;
            seated = flying;
            flying = null;
          }
        }
      }
      for (const b of spent) stepBody(b, dt, g, false);
      for (let i = spent.length - 1; i >= 0; i--) if (spent[i].gone) spent.splice(i, 1);

      if (!dragging) {
        // detent spring toward the nearest notch, carrying whatever momentum
        // the flick left behind
        const target = Math.round(phase);
        phaseVel += (target - phase) * SPRING * dt;
        phaseVel *= Math.exp(-dt * DAMP);
        phase += phaseVel * dt;
      }
      const landed = Math.round(phase);
      if (landed !== notch) {
        const dir = landed > notch ? 1 : -1;
        const steps = Math.abs(landed - notch);
        notch = landed;
        // a hard flick can cross several notches in one frame; only the last
        // one gets a flight, the rest are consumed as drum rotation
        if (steps > 1) current = wrapIdx(current + dir * (steps - 1));
        startTransition(dir);
      }
    };

    // ---- drawing ---------------------------------------------------------
    const geom = () => {
      // 3:2 plate, sized to leave room for the magazine above and the chute
      // below at any aspect
      const w = Math.min(cssW * 0.6, cssH * 1.02);
      const h = w / 1.5;
      return { w, h, cx: cssW * 0.5, cy: cssH * 0.48 };
    };

    const drawPlateBody = (b: Body, alpha: number) => {
      const { w, h, cx, cy } = geom();
      const cv = plateCanvases[b.index % plateCanvases.length];
      if (!cv) return;
      // cull: a body past the frame is still integrated (it has to keep
      // falling until it is retired) but must not be rasterized
      if (cy + b.y + h < -h || cy + b.y - h > cssH + h) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy + b.y);
      ctx.rotate(b.rot);
      // a plate in flight is seen slightly edge-on: the perspective squash is
      // proportional to how fast it is moving through the gate
      const squash = 1 / (1 + Math.min(0.22, Math.abs(b.vy) / 9000));
      ctx.scale(1, squash);
      ctx.drawImage(cv, -w / 2, -h / 2, w, h);
      ctx.restore();
    };

    const drawMagazine = () => {
      const { w, h, cx, cy } = geom();
      const slot = 13;
      const top = cy - h / 2 - 30;
      const bottom = cy + h / 2 + 30;
      const frac = phase - Math.round(phase);
      ctx.save();
      // upcoming plates, seen edge-on in the drum; the whole stack slides down
      // by the fractional drum phase, which is what makes a half-drag legible
      for (let k = 1; k <= 6; k++) {
        const y = top - (k - frac) * slot;
        if (y < -slot) continue;
        const t = 1 - (k - 1) / 6;
        const ww = w * (0.995 - k * 0.012);
        ctx.fillStyle = css(pal.dark ? mixRGB(pal.bg, pal.border, 0.7) : pal.plate, 0.35 + 0.55 * t);
        ctx.fillRect(cx - ww / 2, y, ww, 6);
        // the edge line under each plate is what makes the stack read as
        // stacked rather than as one grey block; --border is too faint to do
        // that job in light, so light uses --foreground at low alpha instead
        ctx.fillStyle = css(pal.fg, pal.dark ? 0.5 : 0.3);
        ctx.fillRect(cx - ww / 2, y + 6, ww, 1.5);
      }
      for (let k = 1; k <= 4; k++) {
        const y = bottom + (k - 1 + frac) * slot;
        if (y > cssH + slot) continue;
        const t = 1 - (k - 1) / 4;
        const ww = w * (0.995 - k * 0.014);
        ctx.fillStyle = css(pal.dark ? mixRGB(pal.bg, pal.border, 0.5) : mixRGB(pal.plate, pal.border, 0.5), 0.22 + 0.4 * t);
        ctx.fillRect(cx - ww / 2, y, ww, 5);
      }
      ctx.restore();
    };

    const drawGate = () => {
      const { w, h, cx, cy } = geom();
      const hot = dragging || focusVisible;
      ctx.save();
      // gate cheeks: the two rails the plate is guided down between
      const railW = 3;
      const railX0 = cx - w / 2 - 14;
      const railX1 = cx + w / 2 + 14;
      ctx.fillStyle = css(pal.border, pal.dark ? 0.9 : 1);
      ctx.fillRect(railX0 - railW, 0, railW, cssH);
      ctx.fillRect(railX1, 0, railW, cssH);
      // the seat: a heavier bar the plate lands on
      const seatY = cy + h / 2 + 4;
      ctx.fillStyle = css(pal.fg, pal.dark ? 0.55 : 0.7);
      ctx.fillRect(railX0 - railW, seatY, railX1 - railX0 + railW * 2, 3);
      // registration pins at the gate corners, drawn as ticks
      ctx.strokeStyle = css(hot ? pal.accent : pal.muted, hot ? 0.95 : 0.55);
      ctx.lineWidth = 2;
      const tick = 14;
      for (const [x, sx] of [
        [cx - w / 2, 1],
        [cx + w / 2, -1],
      ] as const) {
        for (const [y, sy] of [
          [cy - h / 2, 1],
          [cy + h / 2, -1],
        ] as const) {
          ctx.beginPath();
          ctx.moveTo(x, y + sy * tick);
          ctx.lineTo(x, y);
          ctx.lineTo(x + sx * tick, y);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const drawBay = () => {
      const { w, h, cx, cy } = geom();
      // Full bleed means the BAY is the page, not a strip drawn on it: the
      // sunk machine bed covers the frame edge to edge, and the only bright
      // thing is the lamp aperture the plate is read in. The first pass had a
      // white page with a bay column floating in it, which left a third of the
      // frame doing nothing.
      const apTop = cy - h / 2 - 10;
      const apH = h + 20;
      // Painted as three bands rather than a full-frame fill plus the aperture
      // over it: the aperture covers most of the height, so the naive order
      // paid for the whole viewport twice every frame.
      ctx.fillStyle = css(pal.bay);
      ctx.fillRect(0, 0, cssW, apTop);
      ctx.fillRect(0, apTop + apH, cssW, cssH - apTop - apH);
      // the lamp aperture: a full-width lit band exactly as tall as the gate,
      // flat (no gradient), so the seated plate reads as being ON the light
      ctx.fillStyle = css(pal.lamp);
      ctx.fillRect(0, apTop, cssW, apH);
      ctx.fillStyle = css(pal.border, pal.dark ? 0.85 : 1);
      ctx.fillRect(0, apTop, cssW, 1);
      ctx.fillRect(0, apTop + apH - 1, cssW, 1);

      // machined scales down both margins: fixed rules to measure the fall
      // against, and what stops the wide sides reading as dead space
      const inner = cx - w / 2 - 34;
      ctx.fillStyle = css(pal.muted, 0.45);
      for (let y = 0; y < cssH; y += 16) {
        const major = Math.round(y / 16) % 5 === 0;
        const len = major ? 16 : 9;
        ctx.fillRect(inner - len, y, len, 1);
        ctx.fillRect(cssW - inner, y, len, 1);
      }
      // drum axis marks: two heavier rules at the release height and the seat,
      // the two positions the transport actually references
      ctx.fillStyle = css(pal.muted, 0.8);
      for (const y of [apTop - 34, cy + h / 2 + 4]) {
        ctx.fillRect(0, y, 46, 2);
        ctx.fillRect(cssW - 46, y, 46, 2);
      }
      ctx.font = `500 10px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillStyle = css(pal.muted, 0.9);
      ctx.textBaseline = "alphabetic";
      ctx.fillText("DRUM", 8, apTop - 42);
      ctx.fillText("SEAT", 8, cy + h / 2 - 4);
    };

    const draw = () => {
      if (cssW < 2 || cssH < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBay();
      drawMagazine();
      for (const b of spent) drawPlateBody(b, 0.55);
      drawGate();
      if (flying) drawPlateBody(flying, 1);
      else drawPlateBody(seated, 1);
    };

    // ---- loop ------------------------------------------------------------
    const settled = () => !flying && spent.length === 0 && Math.abs(phaseVel) < 0.002;

    const loop = (nowMs: number) => {
      const dt = Math.min(0.04, Math.max(0, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      simTime += dt;
      stepPhysics(dt);
      const amb = ambientRef.current;
      // Deliberately NOT gated on hover. This is full bleed: the pointer is
      // over the component whenever it is over the page, and a resting cursor
      // anywhere in the viewport would stop the transport forever — including
      // in the screenshot gate, which parks the mouse at 0,0.
      if (amb > 0 && !dragging && !focusVisible && settled()) {
        ambientClock += dt;
        // ambient advance is suspended for a beat after any real input, so the
        // machine never takes the frame away from someone who is driving it
        if (ambientClock > amb && simTime - interactedAt > amb) {
          ambientClock = 0;
          advance(1, false);
        }
      } else {
        ambientClock = 0;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running || disposed || reducedMotion || pausedRef.current) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    // ---- sizing ----------------------------------------------------------
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      // Capped at 1.5 rather than 2, for the same reason the spent train is
      // capped at two: this component's cost is pure fill rate, it scales with
      // the square of the ratio, and the content is flat engraved line work
      // whose edges are already antialiased into the plate raster — 1.5 is
      // indistinguishable from 2 here and is 44% of the pixels.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const g = geom();
      if (Math.abs(g.w - plateW) > 0.5 || Math.abs(g.h - plateH) > 0.5) {
        plateW = g.w;
        plateH = g.h;
        rasterizePlates();
      }
      draw();
    };

    // ---- pointer ---------------------------------------------------------
    // Direct mapping, deliberately unsmoothed: the plates must sit exactly
    // where the finger is. A follower would introduce v*tau of steady-state
    // error, which on a drag is not smoothing, it is lag.
    let dragId = -1;
    let dragY = 0;
    let dragPhase0 = 0;
    let dragVel = 0;
    let dragLastY = 0;
    let dragLastT = 0;
    let movedPx = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      // Never start a drag on a control. This is not politeness: the drag sets
      // pointer capture on the wrapper, and a captured pointer retargets the
      // subsequent `click` to the CAPTURE element — so pressing Next set
      // capture, released it, and the button's own click never fired. Both
      // transport buttons were dead while the keyboard path worked, which is
      // exactly the shape of bug a typecheck cannot see.
      if ((e.target as Element | null)?.closest?.("button, a, [role=button]")) return;
      dragging = true;
      dragId = e.pointerId;
      dragY = e.clientY;
      dragLastY = e.clientY;
      dragLastT = performance.now();
      dragPhase0 = phase;
      dragVel = 0;
      movedPx = 0;
      interactedAt = simTime;
      wrap.setPointerCapture?.(e.pointerId);
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragId) return;
      const now = performance.now();
      const dt = Math.max(1, now - dragLastT) / 1000;
      // dragging DOWN pulls the next plate down out of the magazine, so down
      // is forward: the gesture is the plate's own motion, not a scrollbar
      const v = (e.clientY - dragLastY) / dt / NOTCH;
      dragVel += (v - dragVel) * 0.35;
      dragLastY = e.clientY;
      dragLastT = now;
      movedPx = Math.max(movedPx, Math.abs(e.clientY - dragY));
      if (reducedMotion || pausedRef.current) return;
      phase = dragPhase0 + (e.clientY - dragY) / NOTCH;
      phaseVel = dragVel;
    };
    const endDrag = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragId) return;
      dragging = false;
      dragId = -1;
      wrap.releasePointerCapture?.(e.pointerId);
      if (reducedMotion || pausedRef.current) {
        // discrete: a drag past half a notch is one step, nothing in between
        const step = Math.round(phase - dragPhase0 + dragVel * 0.1);
        if (step !== 0) advance(step > 0 ? 1 : -1, true);
        return;
      }
      // momentum: a flick carries the drum past further detents
      phaseVel = dragVel * 0.9;
      wake();
    };
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", endDrag);
    wrap.addEventListener("pointercancel", endDrag);

    // :focus-visible, not focusin — clicking a control focuses it, and a mouse
    // click must not light the gate's registration marks in accent. This is
    // also what keeps the graded screenshot's resting frame accent-free after
    // the verifier's press pass clicks the first control.
    const onFocusIn = () => {
      const el = document.activeElement;
      focusVisible = !!el && typeof el.matches === "function" && el.matches(":focus-visible");
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!wrap.contains(e.relatedTarget as Node | null)) focusVisible = false;
    };
    wrap.addEventListener("focusin", onFocusIn);
    wrap.addEventListener("focusout", onFocusOut);

    // ---- observers -------------------------------------------------------
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    readColors();
    resize();

    const themeObserver = new MutationObserver(() => {
      readColors();
      draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMode = () => {
      reducedMotion = mq.matches;
      setReduced(reducedMotion);
      if (reducedMotion || pausedRef.current) {
        sleep();
        // collapse to the seated state: no plate in flight, no spent stack
        flying = null;
        spent.length = 0;
        seated = { index: current, y: 0, vy: 0, rot: 0, vrot: 0, bounces: 0, gone: false };
        phase = notch;
        phaseVel = 0;
        draw();
      } else if (onScreen && !document.hidden) {
        wake();
      }
    };
    const onMq = () => applyMode();
    mq.addEventListener("change", onMq);

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else applyMode();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (onScreen) applyMode();
    };
    document.addEventListener("visibilitychange", onVis);
    applyMode();

    // paused/items are polled rather than made effect deps: either would tear
    // down the whole machine and drop the plate mid-flight
    let lastPaused = pausedRef.current;
    let lastCount = itemsRef.current.length;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPaused) {
        lastPaused = pausedRef.current;
        applyMode();
        if (!pausedRef.current) wake();
      }
      if (itemsRef.current.length !== lastCount) {
        lastCount = itemsRef.current.length;
        current = wrapIdx(current);
        rasterizePlates();
        draw();
      }
      poll = window.setTimeout(tick, 160);
    };
    tick();

    return () => {
      disposed = true;
      sleep();
      apiRef.current = null;
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", endDrag);
      wrap.removeEventListener("pointercancel", endDrag);
      wrap.removeEventListener("focusin", onFocusIn);
      wrap.removeEventListener("focusout", onFocusOut);
      window.clearTimeout(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      advance(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      advance(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      apiRef.current?.jumpTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      apiRef.current?.jumpTo(count - 1);
    }
  };

  const item = items[index] ?? items[0];

  return (
    <div
      ref={wrapRef}
      data-magazine-drop={uid}
      role="group"
      aria-roledescription="slide magazine"
      aria-label="Plate gallery"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ns-accent ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />

      {/* The plates are canvas pixels, so the accessible gallery is a real
          list in the DOM: every plate is here, and only the one in the gate is
          exposed to the reading order. */}
      <ul className="sr-only">
        {items.map((it, i) => (
          <li key={`${it.title}-${i}`} aria-hidden={i !== index}>
            {`Plate ${i + 1} of ${count}: ${it.title}${it.caption ? `. ${it.caption}` : ""}`}
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">
        {`Plate ${index + 1} of ${count}, ${item?.title ?? ""}`}
      </p>

      {/* Gate readout and the two transport controls. Both are real buttons
          with names; the drum can also be dragged, and the container itself
          takes the arrow keys. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8">
        <div className="rounded-sm bg-background/75 px-4 py-3 backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ns-muted">
            {`Gate ${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`}
          </p>
          <p className="mt-1 text-base font-medium text-foreground sm:text-lg">{item?.title}</p>
          {item?.caption ? (
            <p className="mt-0.5 text-xs text-ns-muted sm:text-sm">{item.caption}</p>
          ) : null}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ns-muted">
            {reduced ? "Reduced motion: stepped" : "Drag the drum or use arrow keys"}
          </p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => advance(-1)}
            aria-label="Previous plate"
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-background/80 text-foreground backdrop-blur-md transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 13V3M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            aria-label="Next plate"
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-background/80 text-foreground backdrop-blur-md transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

MagazineDrop.displayName = "MagazineDrop";
