"use client";

import * as React from "react";

export interface SieveThrowItem {
  /** Visible result text. Real DOM type — the mechanism moves it, never redraws it. */
  label: string;
  /** Short mono annotation printed on the same grain. */
  meta?: string;
  href?: string;
}

export interface SieveThrowProps {
  items?: SieveThrowItem[];
  /** Text of the control that opens the overlay. */
  triggerLabel?: string;
  /** Accessible name of the overlay dialog. */
  label?: string;
  /** Visible label above the query field. */
  fieldLabel?: string;
  placeholder?: string;
  /** Render with the overlay already open — how the demo shows the deck at rest. */
  defaultOpen?: boolean;
  onSelect?: (item: SieveThrowItem) => void;
  /** Page content the deck covers. */
  children?: React.ReactNode;
  className?: string;
}

const DEFAULT_ITEMS: SieveThrowItem[] = [
  { label: "Weld Pool", meta: "loud / canvas" },
  { label: "Crease Fall", meta: "loud / overlay" },
  { label: "Dye Whorl", meta: "loud / canvas" },
  { label: "Shear Billow", meta: "loud / canvas" },
  { label: "Granule Churn", meta: "loud / canvas" },
  { label: "Blade Stop", meta: "loud / motion" },
  { label: "Edge Yield", meta: "loud / motion" },
  { label: "Ebb Flat", meta: "loud / canvas" },
  { label: "Flyback Tear", meta: "loud / canvas" },
  { label: "Kamacite Etch", meta: "loud / texture" },
  { label: "Accordion Latch", meta: "core / disclosure" },
  { label: "Autosave Ratchet", meta: "core / status" },
  { label: "Avatar Stack Flock", meta: "core / identity" },
  { label: "Badge Unread Tarnish", meta: "core / badge" },
  { label: "Breadcrumb Fold", meta: "core / nav" },
  { label: "Button Cooldown Heat", meta: "core / button" },
  { label: "Carousel Card Riffle", meta: "core / carousel" },
  { label: "Checkbox Domino Run", meta: "core / input" },
  { label: "Confirm Hold Ink", meta: "core / confirm" },
  { label: "Context Menu Unfold", meta: "core / menu" },
  { label: "Copy Field Crimp", meta: "core / clipboard" },
  { label: "Countdown Vapor Digits", meta: "core / time" },
  { label: "Date Picker Moon", meta: "core / date" },
  { label: "Dock Cursor Magnify", meta: "core / dock" },
  { label: "Drawer Counterweight", meta: "core / overlay" },
  { label: "Dropdown Drape", meta: "core / menu" },
  { label: "Empty State Pegboard", meta: "core / empty" },
  { label: "Feed Escapement", meta: "core / feed" },
  { label: "Loader Loom Weave", meta: "loud / loader" },
  { label: "Not Found Postmark", meta: "loud / page" },
  { label: "Reveal Cloth Unfurl", meta: "loud / reveal" },
  { label: "Rosensweig Crest", meta: "loud / canvas" },
  { label: "Scroll Defrost", meta: "loud / scroll" },
  { label: "Slider Chladni Tune", meta: "loud / slider" },
  { label: "Sticker Peel", meta: "loud / affordance" },
  { label: "Success Iron Filings", meta: "loud / success" },
  { label: "Success Nucleation", meta: "loud / success" },
  { label: "Terrain Erosion Carve", meta: "loud / canvas" },
  { label: "Text Prism Split", meta: "loud / type" },
  { label: "Text Stitch Unpick", meta: "loud / type" },
  { label: "Toast Newton Cradle", meta: "loud / toast" },
  { label: "Transition Panel Crumble", meta: "loud / transition" },
  { label: "Hero Oscilloscope", meta: "loud / hero" },
  { label: "Hero Cloth Type", meta: "loud / hero" },
  { label: "Hero Gravity Well", meta: "loud / hero" },
  { label: "Chart Bar Halftone", meta: "core / chart" },
  { label: "Chart Line Dither", meta: "core / chart" },
  { label: "Diff Unified Viewer", meta: "core / diff" },
];

/** Screen apertures, coarsest first. The last deck is the pan: nothing leaves it. */
const DECKS = ["2.00 mm", "1.00 mm", "500 µm", "250 µm", "pan"] as const;
const NDECK = DECKS.length;
/**
 * Share of the stack height each deck's band gets. Coarse decks carry big type;
 * the pan gets the deepest bed because everything a query rejects ends up in it.
 */
const BAND_W = [0.32, 0.16, 0.13, 0.13, 0.26];
/** Height reserved under each mesh for its aperture label. */
const LABEL_H = 20;
/** Spacing of the drawn mesh openings, px — the aperture, made visible. */
const MESH_GAP = [30, 20, 13, 8];
/** Type scale of a grain sitting on deck k. */
const DECK_SCALE = [1.85, 1.12, 0.84, 0.63, 0.46];
/** Ink strength of a grain on deck k. */
const DECK_INK = [1, 0.74, 0.56, 0.42, 0.32];

// Slow gravity on purpose: at true scale a grain crosses a deck in 90 ms and the
// separation is over before it can be read. 1500 px/s^2 keeps a fall legible.
const G = 1500; // px/s^2
const SHAKE_HZ = 3.05;
const SHAKE_AMP = 10; // px, at unit energy
const IDLE_ENERGY = 0.34;

/** Deterministic per-item grain size, used when there is no query to sort by. */
function grainOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 8) % 1000) / 1000;
}

/**
 * Subsequence match with contiguity, word-boundary and prefix bonuses.
 * Returns 0 for no match, otherwise a 0..1 score that becomes a grain size.
 */
function score(label: string, meta: string, q: string) {
  if (!q) return -1;
  const hay = (label + " " + meta).toLowerCase();
  const needle = q.toLowerCase().replace(/\s+/g, "");
  if (!needle) return -1;
  let hi = 0;
  let hits = 0;
  let run = 0;
  let best = 0;
  let boundary = 0;
  for (let ni = 0; ni < needle.length; ni++) {
    const c = needle[ni];
    const found = hay.indexOf(c, hi);
    if (found === -1) return 0;
    if (found === hi && ni > 0) run++;
    else run = 1;
    best = Math.max(best, run);
    if (found === 0 || hay[found - 1] === " " || hay[found - 1] === "/") boundary++;
    hits++;
    hi = found + 1;
  }
  const density = hits / Math.max(1, hi);
  const contiguity = best / needle.length;
  const bonus = boundary / needle.length;
  const s = 0.16 + contiguity * 0.52 + bonus * 0.2 + density * 0.12;
  return Math.min(1, s);
}

/** Grain size -> which screen it can no longer pass. */
function deckFor(s: number) {
  // Below the finest aperture nothing is retained: it goes to the pan. A real
  // match never scores under 0.16, so this only ever catches fine natural grain.
  if (s < 0.12) return NDECK - 1;
  if (s >= 0.72) return 0;
  if (s >= 0.56) return 1;
  if (s >= 0.42) return 2;
  return 3;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

type Grain = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  phase: number;
  air: boolean;
  /** Seconds still to be worked across the mesh before this grain can pass. */
  wait: number;
  /** The deck it was last flowed onto, so a change of screen can be detected. */
  deck: number;
  /** Height of this grain above its screen — the bed it sits in. */
  bed: number;
};

type Fine = { x: number; y: number; vy: number; ty: number; ph: number; k: number; deck: number; bed: number };

/**
 * A full-screen search overlay built as a gyratory sieve shaker. The corpus is a
 * charge of grain lying on a stack of five screens; the query is the grain
 * SIZE. Every keystroke re-sizes each grain, so grains that no longer pass their
 * screen ride up on the throw and grains that got smaller drop through the mesh,
 * deck by deck, until the strong matches are the only thing left on the coarse
 * top screen and everything else has worked its way into the pan.
 *
 * Nothing restarts on a keystroke: the deck keeps shaking, targets change, and
 * grains migrate from wherever they currently are. The result text is real DOM
 * type throughout — only its position, scale and ink are driven by the sim. The
 * canvas behind it carries the fines, which follow the same sort.
 */
export function SieveThrow({
  items = DEFAULT_ITEMS,
  triggerLabel = "Search",
  label = "Search the charge",
  fieldLabel = "Query — sets the grain size",
  placeholder = "Type to size the charge",
  defaultOpen = false,
  onSelect,
  children,
  className,
}: SieveThrowProps) {
  const reduced = usePrefersReducedMotion();
  const uid = React.useId();
  const listId = `${uid}-deck`;
  const inputId = `${uid}-q`;

  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  // Opened by the user (rather than mounted open for display) is what turns the
  // overlay into a real modal: autofocus and the focus trap only engage then, so
  // a page that renders the deck at rest does not steal focus from the document.
  const userOpened = React.useRef(false);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const stackRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const chipRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const n = items.length;

  // Grain size per item for the current query. -1 means "no query": fall back to
  // the item's own natural grain so the resting deck is a spread charge, not a
  // single heap on the top screen.
  const sizes = React.useMemo(
    () =>
      items.map((it) => {
        const s = score(it.label, it.meta ?? "", query);
        return s < 0 ? grainOf(it.label) * 0.98 : s;
      }),
    [items, query],
  );
  const matched = query.trim().length > 0;
  const decks = React.useMemo(() => sizes.map(deckFor), [sizes]);

  /** Selectable results, ranked. With no query every grain is still a result. */
  const results = React.useMemo(() => {
    const idx = items.map((_, i) => i).filter((i) => (matched ? sizes[i] > 0 : true));
    idx.sort((a, b) => sizes[b] - sizes[a] || a - b);
    return idx;
  }, [items, sizes, matched]);

  const retained = React.useMemo(() => decks.filter((d) => d === 0).length, [decks]);
  const rejected = matched ? n - results.length : 0;

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  // ---- simulation state -------------------------------------------------
  const grains = React.useRef<Grain[]>([]);
  if (grains.current.length !== n) {
    grains.current = Array.from({ length: n }, (_, i) => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      phase: (grainOf(items[i]?.label ?? String(i)) * Math.PI * 2) as number,
      air: false,
      wait: 0,
      deck: -1,
      bed: 0,
    }));
  }
  const fines = React.useRef<Fine[]>([]);
  const widths = React.useRef<number[]>([]);
  const box = React.useRef({ w: 0, h: 0 });
  /** Grain size actually in use on each screen — see the fit in `layout`. */
  const scaleOf = React.useRef<number[]>([...DECK_SCALE]);
  /**
   * Where the screens currently sit, and where the current load says they
   * should. The stack is sprung: a screen carrying material opens up and its
   * neighbours close, so there is never a band of empty deck for its own sake.
   */
  const fracs = React.useRef<number[]>([...BAND_W]);
  const fracTarget = React.useRef<number[]>([...BAND_W]);
  const lineRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const energy = React.useRef(IDLE_ENERGY);
  const clock = React.useRef(0);
  const raf = React.useRef(0);
  const lastT = React.useRef(0);
  const running = React.useRef(false);
  const visible = React.useRef(true);
  // Seeded from the cascade at mount; never a literal on screen (the first paint
  // happens inside the token effect below, which runs before any frame).
  const ink = React.useRef({ muted: "transparent", border: "transparent" });
  const placed = React.useRef(false);

  /** Bottom edge (the screen surface) of deck k, in stack pixels. */
  const deckLine = React.useCallback((k: number) => {
    const h = box.current.h;
    let acc = 0;
    for (let i = 0; i <= k; i++) acc += fracs.current[i];
    // The pan is the floor of the stack, so its share ends exactly at the
    // bottom edge and its aperture label — which prints under every mesh —
    // would fall off screen. Lift that last line clear by the label's height.
    return k === NDECK - 1 ? Math.min(acc * h, h - LABEL_H) : acc * h;
  }, []);

  /**
   * Flow the grains along each screen: left to right from the feed edge,
   * piling upward off the mesh when a line is full. Layout only runs when the
   * charge is re-sized or the stack is resized — never per frame.
   */
  const layout = React.useCallback(() => {
    const w = box.current.w;
    if (!w) return;
    const pad = Math.min(48, w * 0.045);
    const order = items.map((_, i) => i);
    order.sort((a, b) => decks[a] - decks[b] || sizes[b] - sizes[a] || a - b);

    // Flow one screen at its trial grain size and report the bed it produces.
    const flow = (deck: number[], sc: number) => {
      let x = pad;
      let line = 0;
      const at: { x: number; line: number }[] = [];
      for (const i of deck) {
        const gw = (widths.current[i] || 140) * sc;
        if (x + gw > w - pad && x > pad) {
          x = pad;
          line += 1;
        }
        at.push({ x, line });
        x += gw + 10 + 12 * sc;
      }
      return { at, lines: line + 1 };
    };

    // How much deck each screen is entitled to: half its standing share, half
    // the share of the charge it is actually carrying. A cleared screen closes
    // up, a loaded one opens, and the stack has no dead freeboard in any state.
    const load = Array.from({ length: NDECK }, (_, k) => decks.filter((d) => d === k).length);
    const total = Math.max(1, load.reduce((a, b) => a + b, 0));
    // The load term is capped: a pan holding three quarters of the charge should
    // open up, but not swallow the stack and leave the retained screens as slots.
    const raw = load.map((l, k) => Math.max(0.07, 0.5 * BAND_W[k] + 0.5 * Math.min(0.45, l / total)));
    const sum = raw.reduce((a, b) => a + b, 0);
    fracTarget.current = raw.map((r) => r / sum);

    const line = new Array<number>(items.length).fill(0);
    const xs = new Array<number>(items.length).fill(pad);
    for (let k = 0; k < NDECK; k++) {
      const deck = order.filter((i) => decks[i] === k);
      const band = fracTarget.current[k] * box.current.h - LABEL_H;
      // A screen's grain is set as large as its own bed allows: the top screen
      // holding the whole charge is a fine, tightly packed bed, and as a query
      // sheds material off it the survivors coarsen into headline type. The size
      // is chosen so the pile always fits between the mesh and the label above.
      let sc = DECK_SCALE[k];
      let f = flow(deck, sc);
      for (let guard = 0; guard < 10 && f.lines * (34 * sc + 8) > band && sc > 0.3; guard++) {
        sc = Math.max(0.3, sc * 0.86);
        f = flow(deck, sc);
      }
      scaleOf.current[k] = sc;
      deck.forEach((i, j) => {
        xs[i] = f.at[j].x;
        line[i] = f.at[j].line;
      });
    }
    const pitch = scaleOf.current.map((sc) => 34 * sc + 8);

    for (const i of order) {
      const k = decks[i];
      const sc = scaleOf.current[k];
      const g = grains.current[i];
      if (g.deck !== k) {
        // A charge does not all pass at once: each grain has to be worked across
        // the mesh before it finds a hole, and how long that takes is what makes
        // the separation a cascade rather than a cut. Deeper drops start sooner
        // — the undersize is what a screen sheds first.
        const drop = Math.abs(k - (g.deck < 0 ? k : g.deck));
        g.wait = 0.04 + (g.phase / (Math.PI * 2)) * 0.5 - Math.min(0.2, drop * 0.05);
        g.deck = k;
      }
      g.tx = xs[i];
      // Grains rest ON the mesh, so their height is held as an offset above it,
      // not an absolute y: when the stack re-springs, the bed rides with it.
      g.bed = 3 + line[i] * pitch[k] + 34 * sc;
    }
    // Fines belong to a grain each, so the dust migrates with the sort and the
    // bed on a loaded screen is visibly deeper than the bed on a cleared one.
    for (let i = 0; i < fines.current.length; i++) {
      const f = fines.current[i];
      const k = decks[f.k];
      if (k === undefined) continue;
      const depth = Math.min(fracTarget.current[k] * box.current.h * 0.5, 5 + load[k] * 2.4);
      // sqrt bias: dust packs densest against the mesh and thins upward.
      const r = Math.sqrt(((i * 37) % 101) / 101);
      f.deck = k;
      f.bed = 2 + r * depth;
    }
  }, [items, decks, sizes]);

  /** Snap everything to its target. Used for the first paint and reduced motion. */
  const settle = React.useCallback(() => {
    fracs.current = [...fracTarget.current];
    for (const g of grains.current) g.ty = deckLine(Math.max(0, g.deck)) - g.bed;
    for (const f of fines.current) f.ty = deckLine(f.deck) - f.bed;
    for (const g of grains.current) {
      g.x = g.tx;
      g.y = g.ty;
      g.vx = 0;
      g.vy = 0;
      g.air = false;
    }
    for (const f of fines.current) {
      f.y = f.ty;
      f.vy = 0;
    }
  }, [deckLine]);

  const paintGrains = React.useCallback(
    (gx: number, gy: number, e: number) => {
      const t = clock.current;
      // The screens ride the throw with everything on them.
      for (let k = 0; k < NDECK; k++) {
        const el = lineRefs.current[k];
        if (el) el.style.transform = `translate3d(0, ${(deckLine(k) + gy).toFixed(1)}px, 0)`;
      }
      for (let i = 0; i < grains.current.length; i++) {
        const el = chipRefs.current[i];
        if (!el) continue;
        const g = grains.current[i];
        // Grains on a running screen never sit still: each hops on the throw,
        // out of phase with its neighbours.
        const hop = g.air ? 0 : Math.max(0, Math.sin(t * SHAKE_HZ * 2 * Math.PI + g.phase)) * 3.2 * e;
        el.style.transform = `translate3d(${(g.x + gx).toFixed(1)}px, ${(g.y + gy - hop).toFixed(1)}px, 0) scale(${scaleOf.current[decks[i]].toFixed(3)})`;
      }
    },
    [decks, deckLine],
  );

  const drawFines = React.useCallback(
    (gx: number, gy: number) => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const { w, h } = box.current;
      ctx.clearRect(0, 0, w, h);

      // The screens themselves, drawn to their aperture: a coarse mesh is a few
      // wide openings, the pan is a solid floor. The hairline under each is DOM;
      // this is the weave sitting on it, and it moves with the throw.
      ctx.fillStyle = ink.current.border;
      ctx.globalAlpha = 0.85;
      for (let k = 0; k < NDECK - 1; k++) {
        const y = deckLine(k) + gy;
        const gap = MESH_GAP[k];
        for (let x = ((gx % gap) + gap) % gap; x < w; x += gap) ctx.fillRect(x, y - 3, 1, 3);
      }

      // The fines: dust bound to a grain each, so the dust migrates with the
      // sort. It banks up on a loaded screen and clears off an empty one.
      ctx.fillStyle = ink.current.muted;
      for (const f of fines.current) {
        const g = grains.current[f.k];
        if (!g) continue;
        ctx.globalAlpha = 0.14 + DECK_INK[decks[f.k]] * 0.46;
        const s = 1 + (f.ph % 3) * 0.5;
        ctx.fillRect(f.x + gx, f.y + gy, s, s);
      }
      ctx.globalAlpha = 1;
    },
    [decks, deckLine],
  );

  /**
   * Resolve every bed against where the screens currently are. Beds are stored
   * as a height above the mesh, so a screen that moves carries its material.
   */
  const resolve = React.useCallback(() => {
    for (const g of grains.current) g.ty = deckLine(Math.max(0, g.deck)) - g.bed;
    for (const f of fines.current) f.ty = deckLine(f.deck) - f.bed;
  }, [deckLine]);

  /** One fixed sim substep. Vertical motion is ballistic, horizontal is conveyed. */
  const step = React.useCallback((dt: number) => {
    const t = clock.current;
    const throwPhase = Math.sin(t * SHAKE_HZ * 2 * Math.PI);
    // The stack itself is sprung toward the spacing the current load asks for.
    for (let k = 0; k < NDECK; k++) {
      fracs.current[k] += (fracTarget.current[k] - fracs.current[k]) * Math.min(1, dt * 5);
    }
    resolve();
    for (const g of grains.current) {
      // Conveyed along the screen: a damped pull toward the flow position.
      const k = 62;
      g.vx += (-k * (g.x - g.tx) - 2 * Math.sqrt(k) * g.vx) * dt;
      g.x += g.vx * dt;

      if (g.wait > 0) {
        g.wait -= dt;
        continue;
      }

      const dy = g.ty - g.y;
      if (!g.air) {
        // The threshold is a whole band, not a pixel: a resting grain follows
        // its screen as the stack re-springs, and only a genuine change of deck
        // is enough to put it in the air.
        if (dy > 20) {
          // The grain passed its screen: it is through the mesh and falling.
          g.air = true;
        } else if (dy < -20 && throwPhase > 0.94) {
          // It no longer fits through: the throw kicks it back up a deck, and
          // it only leaves the screen at the top of the stroke, like real grain.
          g.vy = -Math.sqrt(2 * G * Math.abs(dy)) * 1.04;
          g.air = true;
        } else {
          g.y += dy * Math.min(1, 12 * dt);
        }
      }
      if (g.air) {
        g.vy += G * dt;
        g.y += g.vy * dt;
        if (g.y >= g.ty && g.vy > 0) {
          g.y = g.ty;
          if (g.vy > 120) g.vy = -g.vy * 0.24;
          else {
            g.vy = 0;
            g.air = false;
          }
        }
      }
    }
    for (const f of fines.current) {
      const dy = f.ty - f.y;
      if (Math.abs(dy) < 0.6) {
        f.vy = 0;
        f.y = f.ty;
      } else if (dy > 0) {
        f.vy += G * 0.55 * dt;
        f.y += f.vy * dt;
        if (f.y > f.ty) {
          f.y = f.ty;
          f.vy = 0;
        }
      } else {
        if (throwPhase > 0.9 && f.vy === 0) f.vy = -Math.sqrt(2 * G * 0.55 * Math.abs(dy)) * 1.02;
        f.vy += G * 0.55 * dt;
        f.y += f.vy * dt;
        if (f.vy > 0 && f.y >= f.ty) {
          f.y = f.ty;
          f.vy = 0;
        }
      }
    }
  }, [resolve]);

  const frame = React.useCallback(
    (now: number) => {
      if (!running.current) return;
      const dtWall = Math.min(0.05, (now - (lastT.current || now)) / 1000);
      lastT.current = now;
      clock.current += dtWall;
      // Energy decays back to the idle throw between keystrokes.
      energy.current += (IDLE_ENERGY - energy.current) * Math.min(1, dtWall * 2.4);
      let acc = dtWall;
      while (acc > 0) {
        const dt = Math.min(1 / 180, acc);
        acc -= dt;
        step(dt);
      }
      const e = energy.current;
      const t = clock.current;
      // Gyratory throw: the whole deck orbits, so the charge is walked along it.
      const gx = Math.cos(t * SHAKE_HZ * 2 * Math.PI) * SHAKE_AMP * e;
      const gy = Math.sin(t * SHAKE_HZ * 4 * Math.PI) * SHAKE_AMP * 0.34 * e;
      paintGrains(gx, gy, e);
      drawFines(gx, gy);
      raf.current = requestAnimationFrame(frame);
    },
    [step, paintGrains, drawFines],
  );

  const start = React.useCallback(() => {
    if (running.current || reduced) return;
    running.current = true;
    lastT.current = 0;
    raf.current = requestAnimationFrame(frame);
  }, [frame, reduced]);

  const stop = React.useCallback(() => {
    running.current = false;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  // Tokens, read from the cascade and re-read whenever the theme flips.
  React.useEffect(() => {
    if (!open) return;
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      ink.current = {
        muted: cs.getPropertyValue("--ns-muted").trim() || cs.getPropertyValue("--foreground").trim(),
        border: cs.getPropertyValue("--border").trim() || cs.getPropertyValue("--ns-muted").trim(),
      };
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", read);
    };
  }, [open]);

  // Measure the stack and the grains, size the canvas, seed the fines.
  React.useLayoutEffect(() => {
    if (!open) return;
    const stack = stackRef.current;
    if (!stack) return;
    const measure = () => {
      const r = stack.getBoundingClientRect();
      box.current = { w: r.width, h: r.height };
      const cv = canvasRef.current;
      if (cv) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.max(1, Math.round(r.width * dpr));
        cv.height = Math.max(1, Math.round(r.height * dpr));
        cv.style.width = `${r.width}px`;
        cv.style.height = `${r.height}px`;
        const ctx = cv.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      for (let i = 0; i < n; i++) {
        const el = chipRefs.current[i];
        if (el) widths.current[i] = el.offsetWidth;
      }
      if (fines.current.length !== n * 16) {
        fines.current = Array.from({ length: n * 16 }, (_, i) => ({
          x: 0,
          y: 0,
          vy: 0,
          ty: 0,
          ph: i % 11,
          k: i % n,
          deck: 0,
          bed: 0,
        }));
      }
      const pad = Math.min(48, r.width * 0.045);
      for (let i = 0; i < fines.current.length; i++) {
        const f = fines.current[i];
        f.x = pad + ((i * 61) % 997) / 997 * Math.max(1, r.width - pad * 2);
      }
      layout();
      if (!placed.current) {
        settle();
        placed.current = true;
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stack);
    return () => ro.disconnect();
  }, [open, n, layout, settle]);

  // Re-flow on every query change. The sim is NOT reset — grains migrate from
  // wherever they are, which is what makes typing a continuous re-sort.
  React.useEffect(() => {
    if (!open) return;
    layout();
    if (reduced) {
      settle();
      paintGrains(0, 0, 0);
      drawFines(0, 0);
    }
  }, [open, layout, reduced, settle, paintGrains, drawFines]);

  // Run the shaker only while the overlay is open, on screen and in a live tab.
  React.useEffect(() => {
    if (!open) return;
    if (reduced) {
      settle();
      paintGrains(0, 0, 0);
      drawFines(0, 0);
      return;
    }
    start();
    const stack = stackRef.current;
    const io = stack
      ? new IntersectionObserver(
          (entries) => {
            visible.current = entries.some((e) => e.isIntersecting);
            if (visible.current && !document.hidden) start();
            else stop();
          },
          { threshold: 0 },
        )
      : null;
    if (stack && io) io.observe(stack);
    const onVis = () => {
      if (document.hidden) stop();
      else if (visible.current) start();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [open, reduced, start, stop, settle, paintGrains, drawFines]);

  // Escape closes whenever the overlay is open, however it was opened.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus and the modal trap. Only for an overlay the user opened: an overlay
  // rendered open for display must not seize the page's focus on mount.
  React.useEffect(() => {
    if (!open) return;
    const root = overlayRef.current;
    if (!root) return;
    if (!userOpened.current) return;
    inputRef.current?.focus();

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'input:not([disabled]), a[href], button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Tab wrapping alone is not a trap: focus can arrive from outside onto the
    // trigger, which is still in the DOM behind the overlay.
    const onFocusIn = (ev: FocusEvent) => {
      const t = ev.target as Node | null;
      if (t && !root.contains(t)) {
        ev.stopPropagation();
        inputRef.current?.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      root.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      triggerRef.current?.focus();
    };
  }, [open]);

  const close = React.useCallback(() => setOpen(false), []);

  const commit = React.useCallback(
    (i: number) => {
      const it = items[i];
      if (!it) return;
      onSelect?.(it);
      setOpen(false);
    },
    [items, onSelect],
  );

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setActive((a) => {
        const d = e.key === "ArrowDown" ? 1 : -1;
        return (a + d + results.length) % results.length;
      });
      return;
    }
    if (e.key === "Home" && results.length) {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End" && results.length) {
      e.preventDefault();
      setActive(results.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const i = results[active];
      if (i !== undefined) commit(i);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const activeIndex = results[active];

  return (
    <div className={["relative isolate", className].filter(Boolean).join(" ")}>
      {children}

      {open ? (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-40 flex flex-col bg-background"
        >
          {/* Feed head: the query field IS the sizing control. */}
          <div className="shrink-0 border-b border-border px-5 pb-4 pt-5 sm:px-10 sm:pt-8">
            <div className="flex items-baseline justify-between gap-6">
              <label
                htmlFor={inputId}
                className="font-mono text-[10px] uppercase tracking-[0.3em] text-ns-muted sm:text-[11px]"
              >
                {fieldLabel}
              </label>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-ns-muted sm:block sm:text-[11px]">
                gyratory throw / {SHAKE_HZ.toFixed(2)} hz
              </span>
            </div>
            <div className="mt-2 flex items-center gap-4 sm:gap-6">
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex !== undefined ? `${listId}-${activeIndex}` : undefined}
                autoComplete="off"
                spellCheck={false}
                value={query}
                placeholder={placeholder}
                onChange={(ev) => {
                  setQuery(ev.target.value);
                  // Every keystroke is a kick of energy into the deck. The sort
                  // itself is scheduled work; nothing heavy runs here.
                  energy.current = Math.min(1.7, energy.current + 0.85);
                }}
                onKeyDown={onInputKey}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 font-medium text-[clamp(1.6rem,5.2vw,3.4rem)] leading-none tracking-tight text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
              />
              <button
                type="button"
                onClick={close}
                className="group shrink-0 rounded-sm border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.24em] text-ns-muted transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent sm:px-4 sm:text-[11px]"
              >
                Esc / close
              </button>
            </div>
            <p aria-live="polite" aria-atomic="true" className="sr-only">
              {matched
                ? `${results.length} of ${n} matching, ${retained} retained on the top screen, ${rejected} passed to the pan.`
                : `${n} on the deck, nothing sized yet.`}
            </p>
          </div>

          {/* The deck stack. */}
          <div ref={stackRef} className="relative min-h-0 flex-1 overflow-hidden">
            <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

            {/* Screens. Each hairline is the mesh the grains above it are sitting on. */}
            <div aria-hidden="true" className="absolute inset-0">
              {DECKS.map((ap, k) => (
                <div
                  key={ap}
                  ref={(el) => {
                    lineRefs.current[k] = el;
                  }}
                  className="absolute inset-x-0 top-0"
                  style={{
                    transform: `translate3d(0, ${BAND_W.slice(0, k + 1).reduce((a, b) => a + b, 0) * 100}vh, 0)`,
                  }}
                >
                  <div
                    className="h-px w-full bg-border"
                    style={{ opacity: k === NDECK - 1 ? 1 : 0.4 + (1 - k / NDECK) * 0.6 }}
                  />
                  <div className="flex items-center justify-between px-5 pt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-ns-muted sm:px-10 sm:text-[10px]">
                    <span>
                      {String(k + 1).padStart(2, "0")} / {ap}
                    </span>
                    <span>{decks.filter((d) => d === k).length} on screen</span>
                  </div>
                </div>
              ))}
            </div>

            {/* The charge. Real DOM type; the sim only writes transforms. */}
            <div
              id={listId}
              role="listbox"
              aria-label={`${label} — sieve deck`}
              className="absolute inset-0"
            >
              {items.map((it, i) => {
                const k = decks[i];
                const isActive = i === activeIndex;
                const dead = matched && sizes[i] <= 0;
                return (
                  <button
                    key={it.label}
                    ref={(el) => {
                      chipRefs.current[i] = el;
                    }}
                    id={`${listId}-${i}`}
                    role="option"
                    type="button"
                    tabIndex={-1}
                    aria-selected={isActive}
                    aria-disabled={dead || undefined}
                    onClick={() => !dead && commit(i)}
                    className={[
                      "absolute left-0 top-0 flex origin-top-left items-center gap-3 whitespace-nowrap rounded-sm border px-3 py-2 text-left transition-[color,border-color,background-color] duration-150",
                      isActive
                        ? "border-ns-accent bg-background text-foreground"
                        : "border-transparent bg-transparent text-foreground hover:border-border",
                    ].join(" ")}
                    // No will-change: the grain's scale changes when it changes
                    // deck, and promoting it would rasterize the type once at
                    // the old scale and ship a smeared bitmap of the result.
                    style={{ opacity: isActive ? 1 : DECK_INK[k] }}
                  >
                    {isActive ? (
                      <span aria-hidden="true" className="font-mono text-[11px] text-ns-accent">
                        &rarr;
                      </span>
                    ) : null}
                    <span className="text-[15px] font-medium leading-none tracking-tight">
                      {it.label}
                    </span>
                    {it.meta ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ns-muted">
                        {it.meta}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-6 border-t border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-ns-muted sm:px-10 sm:text-[11px]">
            <span>
              {matched ? `${results.length} pass / ${rejected} to pan` : `${n} on deck`}
            </span>
            <span className="hidden sm:block">&uarr;&darr; move &middot; &crarr; open &middot; esc close</span>
          </div>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          userOpened.current = true;
          setOpen(true);
        }}
        style={{ visibility: open ? "hidden" : "visible" }}
        className="group fixed right-5 top-5 z-30 inline-flex items-center gap-3 rounded-sm border border-border bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent sm:right-8 sm:top-8"
      >
        <span aria-hidden="true" className="relative flex h-3.5 w-5 flex-col justify-between">
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current opacity-70" />
          <span className="h-px w-full bg-current opacity-40" />
        </span>
        {triggerLabel}
      </button>
    </div>
  );
}

export default SieveThrow;
