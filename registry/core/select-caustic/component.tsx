"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CausticSelect — single-select whose closed trigger and open listbox are
// frosted glass over live caustic light: 6-8 drifting radial blobs summed
// additively on a canvas BENEATH each surface's backdrop-filter layer, so the
// blur turns them into pooled light. Opening scale-springs the panel from the
// trigger while blob anchors spring-redistribute down the list height; the
// active row (cursor OR keyboard — one target) carries a lens that bends
// nearby caustics up to 6px toward the row so the highlight reads as pressed
// into the glass. Direct-DOM rAF: fully asleep while closed, paused offscreen
// and on hidden tabs, lens has a 1s forced-settle deadline. All drawn ink is
// derived from CSS tokens at mount and re-derived on documentElement class
// changes. Full listbox keyboard pattern with aria-activedescendant.
// ---------------------------------------------------------------------------

const TRIGGER_BLOBS = 6;
const PANEL_BLOBS = 8;
const DRIFT_MIN = 6; // px/s peak drift speed per blob
const DRIFT_MAX = 10;
const OPEN_MS = 180;
const ANCHOR_K = 60; // s^-2 — blob anchor redistribution spring
const ANCHOR_ZETA = 0.9;
const LENS_K = 140; // s^-2 — lens follow spring
const LENS_ZETA = 0.8;
const LENS_R = 56; // px displacement field radius
const LENS_PULL = 6; // px max pull toward the active row center
const SETTLE_MS = 1000; // forced-settle deadline after last input
const TYPEAHEAD_MS = 500;

type Vec3 = readonly [number, number, number];

interface CausticBlob {
  ax: number; // anchor position (spring state)
  ay: number;
  vx: number;
  vy: number;
  tx: number; // anchor target
  ty: number;
  amp: number; // drift amplitude px
  wx: number; // drift angular frequency rad/s (amp*wx = peak px/s)
  wy: number;
  phase: number;
  phase2: number;
  r: number;
  rf: number; // persistent per-blob randoms (radius / layout jitter)
  jx: number;
  jy: number;
  mixT: number; // 0 = --ns-accent, 1 = --foreground
  alpha: number; // 0.06-0.10
}

interface Lens {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  s: number; // strength 0..1
  ts: number;
  on: boolean;
}

export interface CausticSelectOption {
  value: string;
  label: string;
  /** mono hint rendered right of the label (e.g. a region code) */
  hint?: string;
  disabled?: boolean;
}

const DEFAULT_OPTIONS: CausticSelectOption[] = [
  { value: "iad1", label: "Washington, D.C.", hint: "iad1" },
  { value: "sfo1", label: "San Francisco", hint: "sfo1" },
  { value: "fra1", label: "Frankfurt", hint: "fra1" },
  { value: "hnd1", label: "Tokyo", hint: "hnd1" },
  { value: "syd1", label: "Sydney", hint: "syd1" },
  { value: "gru1", label: "São Paulo", hint: "gru1" },
];

// deterministic PRNG — blob character is stable across opens in-session
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function CausticSelect({
  options = DEFAULT_OPTIONS,
  value,
  defaultValue = "",
  onValueChange,
  label = "Region",
  placeholder = "Select a region",
  disabled = false,
  name,
  className = "",
}: {
  /** the selectable options */
  options?: CausticSelectOption[];
  /** controlled value; omit for uncontrolled */
  value?: string;
  /** uncontrolled initial value */
  defaultValue?: string;
  /** called with the new value when a different option is selected */
  onValueChange?: (value: string) => void;
  /** field label rendered above the trigger */
  label?: string;
  /** shown on the trigger while no option is selected */
  placeholder?: string;
  /** blocks the trigger and closes the popover if open */
  disabled?: boolean;
  /** when set, renders a hidden input for form posts */
  name?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const valueId = `${uid}-value`;
  const listboxId = `${uid}-listbox`;
  const optId = (i: number) => `${uid}-opt-${i}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const trigCanvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelCanvasRef = useRef<HTMLCanvasElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const engineRef = useRef<{
    opened: () => void;
    closed: () => void;
    setLens: (i: number) => void;
  } | null>(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const openRef = useRef(open);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const val = isControlled ? value : internal;
  const selected = options.find((o) => o.value === val) ?? null;

  const typeRef = useRef<{ buf: string; timer: number }>({ buf: "", timer: 0 });

  // -- caustic engine: one mount effect, direct-DOM hot path -----------------
  useEffect(() => {
    const root = rootRef.current;
    const trigger = triggerRef.current;
    const tCanvas = trigCanvasRef.current;
    const panel = panelRef.current;
    const pCanvas = panelCanvasRef.current;
    const listbox = listboxRef.current;
    if (!root || !trigger || !tCanvas || !panel || !pCanvas || !listbox) return;
    const tCtx = tCanvas.getContext("2d");
    const pCtx = pCanvas.getContext("2d");
    if (!tCtx || !pCtx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // token-derived ink: read at mount, re-derived on theme class change
    let accent: Vec3 = [0, 107, 255];
    let fg: Vec3 = [237, 237, 237];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      accent = parseColor(cs.getPropertyValue("--ns-accent")) ?? accent;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    derive();

    const rand = mulberry32(0x5eaf00d);
    const makeBlobs = (n: number): CausticBlob[] => {
      const arr: CausticBlob[] = [];
      for (let i = 0; i < n; i++) {
        const amp = 10 + rand() * 6;
        const speed = DRIFT_MIN + rand() * (DRIFT_MAX - DRIFT_MIN);
        arr.push({
          ax: 0,
          ay: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
          amp,
          wx: speed / amp,
          wy: (speed / amp) * 0.83,
          phase: rand() * Math.PI * 2,
          phase2: rand() * Math.PI * 2,
          r: 40,
          rf: rand(),
          jx: rand(),
          jy: rand(),
          mixT: i % 2 === 0 ? 0.12 + rand() * 0.2 : 0.65 + rand() * 0.3,
          alpha: 0.06 + rand() * 0.04,
        });
      }
      return arr;
    };
    const tBlobs = makeBlobs(TRIGGER_BLOBS);
    const pBlobs = makeBlobs(PANEL_BLOBS);

    // hot-path state: locals only, never React state
    let dpr = 1;
    let tW = 0;
    let tH = 0;
    let pW = 0;
    let pH = 0;
    let tSized = false;
    let pSized = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let lastInput = 0;
    let anim: Animation | null = null;
    const lens: Lens = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      s: 0,
      ts: 0,
      on: false,
    };

    // <canvas> is a replaced element — inset never sizes it; set BOTH the CSS
    // size and the backing store explicitly. offsetWidth/Height ignore the
    // open-scale transform, so layout stays honest mid-animation.
    const sizeCanvas = (
      host: HTMLElement,
      canvas: HTMLCanvasElement
    ): { w: number; h: number; ok: boolean } => {
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      if (w < 8 || h < 8) return { w: 0, h: 0, ok: false }; // zero-size guard
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      return { w, h, ok: true };
    };

    const layoutTrigger = () => {
      const n = tBlobs.length;
      for (let i = 0; i < n; i++) {
        const b = tBlobs[i];
        if (!b) continue;
        b.tx = tW * ((i + 0.5) / n) + (b.jx - 0.5) * tW * 0.25;
        b.ty = tH * (0.2 + b.jy * 0.6);
        b.r = 20 + b.rf * 22;
        b.ax = b.tx; // trigger anchors never spring — targets ARE positions
        b.ay = b.ty;
      }
    };
    // redistribute anchors evenly down the list height, jittered laterally
    const layoutPanel = () => {
      const n = pBlobs.length;
      for (let i = 0; i < n; i++) {
        const b = pBlobs[i];
        if (!b) continue;
        b.ty = pH * ((i + 0.5) / n) + (b.jy - 0.5) * pH * 0.12;
        b.tx = pW * (0.12 + b.jx * 0.76);
        b.r = 42 + b.rf * 40;
      }
    };

    // full clear + full redraw every frame — additive blobs must never
    // accumulate (destination-in style fades quantize and pile up forever)
    const drawSurface = (
      ctx: CanvasRenderingContext2D,
      blobs: CausticBlob[],
      w: number,
      h: number,
      t: number,
      lensRef: Lens | null
    ) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        let x = b.ax + Math.sin(t * b.wx + b.phase) * b.amp;
        let y = b.ay + Math.cos(t * b.wy + b.phase2) * b.amp;
        let boost = 0;
        if (lensRef && lensRef.s > 0.01) {
          const dx = lensRef.x - x;
          const dy = lensRef.y - y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.01 && dist < LENS_R) {
            const f = (1 - dist / LENS_R) * lensRef.s;
            x += (dx / dist) * LENS_PULL * f;
            y += (dy / dist) * LENS_PULL * f;
            boost = 0.05 * f;
          }
        }
        const c = mix(accent, fg, b.mixT);
        const a = b.alpha + boost;
        const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`);
        g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // the lens itself: a tight accent pool pressed under the active row
      if (lensRef && lensRef.s > 0.01) {
        const a = 0.09 * lensRef.s;
        const g = ctx.createRadialGradient(
          lensRef.x,
          lensRef.y,
          0,
          lensRef.x,
          lensRef.y,
          LENS_R
        );
        g.addColorStop(
          0,
          `rgba(${accent[0]},${accent[1]},${accent[2]},${a.toFixed(3)})`
        );
        g.addColorStop(1, `rgba(${accent[0]},${accent[1]},${accent[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lensRef.x, lensRef.y, LENS_R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const drawTriggerStatic = () => {
      if (tSized) drawSurface(tCtx, tBlobs, tW, tH, 0, null);
    };
    const drawPanelStatic = () => {
      if (!pSized) return;
      for (const b of pBlobs) {
        b.ax = b.tx;
        b.ay = b.ty;
        b.vx = 0;
        b.vy = 0;
      }
      drawSurface(pCtx, pBlobs, pW, pH, 0, null);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!openRef.current) return; // canvas fully asleep while closed
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      const t = now / 1000;

      // anchor redistribution springs (k=60, zeta=0.9, ~450ms settle)
      const cA = 2 * ANCHOR_ZETA * Math.sqrt(ANCHOR_K);
      for (const b of pBlobs) {
        b.vx += (-ANCHOR_K * (b.ax - b.tx) - cA * b.vx) * dt;
        b.vy += (-ANCHOR_K * (b.ay - b.ty) - cA * b.vy) * dt;
        b.ax += b.vx * dt;
        b.ay += b.vy * dt;
      }

      // lens follow spring (k=140, zeta=0.8) + forced-settle deadline —
      // never trusts epsilon alone
      if (lens.on) {
        if (now - lastInput > SETTLE_MS) {
          lens.x = lens.tx;
          lens.y = lens.ty;
          lens.vx = 0;
          lens.vy = 0;
          lens.s = lens.ts;
        } else {
          const cL = 2 * LENS_ZETA * Math.sqrt(LENS_K);
          lens.vx += (-LENS_K * (lens.x - lens.tx) - cL * lens.vx) * dt;
          lens.vy += (-LENS_K * (lens.y - lens.ty) - cL * lens.vy) * dt;
          lens.x += lens.vx * dt;
          lens.y += lens.vy * dt;
          lens.s += (lens.ts - lens.s) * Math.min(1, dt * 12);
        }
      }

      if (tSized) drawSurface(tCtx, tBlobs, tW, tH, t, null);
      if (pSized) drawSurface(pCtx, pBlobs, pW, pH, t, lens.on ? lens : null);

      // idle simmer is the ambient default while open; sleeps offscreen/hidden
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && !reduced && openRef.current && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const resizeTrigger = () => {
      const s = sizeCanvas(trigger, tCanvas);
      tW = s.w;
      tH = s.h;
      tSized = s.ok;
      if (tSized) layoutTrigger();
      if (!openRef.current || reduced) drawTriggerStatic();
    };
    const resizePanel = () => {
      const s = sizeCanvas(panel, pCanvas);
      pW = s.w;
      pH = s.h;
      pSized = s.ok;
      if (pSized) layoutPanel();
    };
    resizeTrigger();

    const opened = () => {
      resizePanel();
      lens.on = false;
      lens.s = 0;
      lens.ts = 0;
      if (reduced) {
        // static frost texture, instant open — no drift, no lens
        drawTriggerStatic();
        drawPanelStatic();
        return;
      }
      // anchors start clustered at the transform origin, spring outward
      for (const b of pBlobs) {
        b.ax = pW / 2 + (b.jx - 0.5) * pW * 0.3;
        b.ay = b.jy * 18;
        b.vx = 0;
        b.vy = 0;
      }
      anim?.cancel();
      anim = panel.animate(
        [
          { transform: "scale(0.96)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: OPEN_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
      wake();
    };

    const closed = () => {
      anim?.cancel();
      anim = null;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      lens.on = false;
      lens.s = 0;
      drawTriggerStatic();
    };

    const setLens = (i: number) => {
      if (!openRef.current || reduced) return;
      const row = listbox.children.item(i) as HTMLElement | null;
      if (!row) return;
      // panel is DOM-anchored: lens works in panel-local offsets, never
      // absolute canvas/page coordinates
      const pr = panel.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const cx = rr.left - pr.left + rr.width / 2;
      const cy = rr.top - pr.top + rr.height / 2;
      if (!lens.on) {
        lens.x = cx;
        lens.y = cy;
        lens.vx = 0;
        lens.vy = 0;
        lens.on = true;
      }
      lens.tx = cx;
      lens.ty = cy;
      lens.ts = 1;
      lastInput = performance.now();
      wake();
    };

    engineRef.current = { opened, closed, setLens };

    // -- observers ----------------------------------------------------------
    const ro = new ResizeObserver(() => {
      resizeTrigger();
      if (openRef.current) {
        resizePanel();
        if (reduced) drawPanelStatic();
        wake();
      }
    });
    ro.observe(trigger);
    ro.observe(panel);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    // live theme re-derive: watch documentElement class flips
    const mo = new MutationObserver(() => {
      derive();
      if (!openRef.current) drawTriggerStatic();
      else if (reduced) {
        drawTriggerStatic();
        drawPanelStatic();
      }
      // open + animating: next loop frame repaints with the new ink
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      anim?.cancel();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      engineRef.current = null;
    };
  }, []);

  // -- open/close orchestration ----------------------------------------------
  useEffect(() => {
    openRef.current = open;
    const eng = engineRef.current;
    if (!eng) return;
    if (open) {
      eng.opened();
      listboxRef.current?.focus({ preventScroll: true });
    } else {
      eng.closed();
    }
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listboxRef.current?.children.item(activeIndex) as
      | HTMLElement
      | null;
    el?.scrollIntoView({ block: "nearest" });
    engineRef.current?.setLens(activeIndex);
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    const t = typeRef.current;
    return () => window.clearTimeout(t.timer);
  }, []);

  // -- selection + keyboard --------------------------------------------------
  const firstEnabled = () => options.findIndex((o) => !o.disabled);
  const lastEnabled = () => {
    for (let i = options.length - 1; i >= 0; i--) {
      const o = options[i];
      if (o && !o.disabled) return i;
    }
    return -1;
  };
  const step = (from: number, dir: 1 | -1) => {
    let i = from;
    for (let k = 0; k < options.length; k++) {
      i += dir;
      if (i < 0 || i >= options.length) break;
      const o = options[i];
      if (o && !o.disabled) return i;
    }
    return from;
  };

  const openList = () => {
    if (disabled || open || options.length === 0) return;
    const sel = options.findIndex((o) => o.value === val && !o.disabled);
    setActiveIndex(sel >= 0 ? sel : firstEnabled());
    setOpen(true);
  };
  const closeList = (restoreFocus: boolean) => {
    typeRef.current.buf = "";
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const commit = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (!isControlled) setInternal(o.value);
    onValueChange?.(o.value);
    closeList(true);
  };

  const typeahead = (ch: string) => {
    const t = typeRef.current;
    t.buf += ch.toLowerCase();
    window.clearTimeout(t.timer);
    t.timer = window.setTimeout(() => {
      t.buf = "";
    }, TYPEAHEAD_MS);
    const n = options.length;
    const start = activeIndex >= 0 ? activeIndex : 0;
    const offset = t.buf.length > 1 ? 0 : 1;
    for (let k = 0; k < n; k++) {
      const i = (start + offset + k) % n;
      const o = options[i];
      if (o && !o.disabled && o.label.toLowerCase().startsWith(t.buf)) {
        setActiveIndex(i);
        return;
      }
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (
      e.key === "Enter" ||
      e.key === " " ||
      e.key === "ArrowDown" ||
      e.key === "ArrowUp"
    ) {
      e.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key;
    if (key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((a) => step(a, 1));
    } else if (key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((a) => step(a, -1));
    } else if (key === "Home") {
      e.preventDefault();
      const i = firstEnabled();
      if (i >= 0) setActiveIndex(i);
    } else if (key === "End") {
      e.preventDefault();
      const i = lastEnabled();
      if (i >= 0) setActiveIndex(i);
    } else if (key === "Enter" || (key === " " && typeRef.current.buf === "")) {
      e.preventDefault();
      commit(activeIndex);
    } else if (key === "Escape") {
      e.preventDefault();
      closeList(true);
    } else if (key === "Tab") {
      closeList(false);
    } else if (key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      typeahead(key);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span
        id={labelId}
        className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ns-muted"
      >
        {label}
      </span>
      {name ? <input type="hidden" name={name} value={val} /> : null}

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        disabled={disabled}
        onClick={() => (open ? closeList(true) : openList())}
        onKeyDown={onTriggerKeyDown}
        className="relative flex h-10 w-full items-center justify-between overflow-hidden rounded-sm border border-border text-left outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none disabled:pointer-events-none"
      >
        {/* caustic light beneath the frost */}
        <canvas
          ref={trigCanvasRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
        />
        {/* the frost itself: backdrop-filter blurs the canvas under it */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-surface/55 backdrop-blur-md backdrop-saturate-150"
        />
        <span
          id={valueId}
          className={`relative z-[1] truncate px-3 text-sm ${
            selected ? "text-foreground" : "text-ns-muted"
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          className={`relative z-[1] mr-3 h-4 w-4 shrink-0 text-ns-muted transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        ref={panelRef}
        className={`absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-md border border-border shadow-[0_8px_16px_-4px_rgba(0,0,0,0.2),0_20px_48px_-12px_rgba(0,0,0,0.35)] ${
          open ? "" : "hidden"
        }`}
        style={{ transformOrigin: "50% 0%" }}
      >
        <canvas
          ref={panelCanvasRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-surface/70 backdrop-blur-xl backdrop-saturate-150"
        />
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={
            open && activeIndex >= 0 ? optId(activeIndex) : undefined
          }
          onKeyDown={onListKeyDown}
          onScroll={() => {
            if (activeIndex >= 0) engineRef.current?.setLens(activeIndex);
          }}
          className="relative z-[1] max-h-72 overflow-y-auto py-1.5 outline-none"
        >
          {options.map((opt, i) => {
            const isActive = i === activeIndex;
            const isSelected = opt.value === val;
            return (
              <li
                key={opt.value}
                id={optId(i)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onPointerMove={() => {
                  if (!opt.disabled && i !== activeIndex) setActiveIndex(i);
                }}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!opt.disabled) commit(i);
                }}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors duration-100 motion-reduce:transition-none ${
                  opt.disabled
                    ? "cursor-not-allowed text-ns-muted/60"
                    : isActive
                      ? "cursor-pointer bg-foreground/[0.07] text-foreground"
                      : "cursor-pointer text-foreground/85"
                }`}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate">{opt.label}</span>
                  {opt.hint ? (
                    <span className="shrink-0 font-mono text-[11px] text-ns-muted">
                      {opt.hint}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-4 w-4 shrink-0 text-ns-accent"
                  >
                    <path
                      d="M3.5 8.5l3 3 6-6.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
