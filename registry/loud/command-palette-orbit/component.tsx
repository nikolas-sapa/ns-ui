"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// EventHorizonCommand — a Cmd-K palette where fuzzy-match results orbit the
// input as pills; orbital radius is inverse match score, so the gravity sim
// IS the ranking visualization. Top match rides the tightest, fastest orbit
// (Kepler-flavored: omega = 1.6 * sqrt(120 / r)) and is consumed on Enter;
// weak matches (< 0.25) destabilize, get flung off as the query sharpens,
// and despawn once their fade completes. An empty query is neutral: every
// command rides a calm staggered orbit until typing sharpens the field.
// Hybrid rendering: real <input> combobox + sr-only listbox for a11y, DOM
// label pills positioned per-frame from the sim (crisp text), one Canvas 2D
// layer underneath for orbit trails + the horizon glow ring. Every drawn
// color derives from CSS tokens at mount and re-derives on theme flips.
// ---------------------------------------------------------------------------

export type CommandItem = {
  id: string;
  label: string;
  category?: string;
};

type Scored = { item: CommandItem; score: number };

type OrbitMode = "hidden" | "active" | "dying" | "consuming";

type Orbit = {
  id: string;
  mode: OrbitMode;
  r: number; // current radius, px (pre-squash)
  vr: number; // radial velocity, px/s
  theta: number; // rad
  gFrom: number; // glide source target radius
  gTo: number; // glide destination target radius
  gStart: number; // performance.now() of last retarget
  alpha: number;
  scale: number;
  dieStart: number;
  consumeStart: number;
  px: number; // previous screen x (trail)
  py: number; // previous screen y (trail)
  hasPrev: boolean;
};

type RGB = [number, number, number];

// ------------------------------ constants ----------------------------------
const R_MIN = 70; // px — perfect-score orbit
const R_SPAN = 220; // px — radius spread across the score range
const SPRING_K = 40; // s^-2 radial spring stiffness
const ZETA = 0.8; // radial damping ratio
const GLIDE_MS = 450; // retarget glide duration
const UNSTABLE_BELOW = 0.25; // score threshold for orbital decay
const FLING_ACCEL = 400; // px/s^2 outward on unstable orbits
const FADE_S = 0.5; // s — unstable fade-out
const CONSUME_R_TAU = 0.12; // s — radius decay constant on Enter
const CONSUME_MS = 260; // scale/opacity consumption duration
const TRAIL_TAU = 0.24; // s — trail alpha decay constant (ink gone < ~1 s)
const TRAIL_MAX_AGE = 1; // s — hard cap on a trail segment's life
const TRAIL_ALPHA = 0.3; // stroke alpha at segment birth
const TRAIL_CAP = 900; // max live trail segments
const GOLDEN = 2.399963229728653; // rad — initial angular spread
const DT_MAX = 0.05; // s — clamp tab-switch jumps
const FIT_REF = R_MIN + R_SPAN + 40; // px the field wants per half-axis

// cubic-bezier(0.22, 1, 0.36, 1) solved via Newton–Raphson
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slopeX(t);
      if (Math.abs(s) < 1e-6) break;
      t -= (sampleX(t) - x) / s;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}
const glideEase = makeBezier(0.22, 1, 0.36, 1);

// deterministic per-id jitter so equal scores never stack on one ring
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

// self-contained scored subsequence match, 0..1; 0 = no subsequence
function fuzzyScore(query: string, label: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0.5; // neutral ring while the query is empty
  const s = label.toLowerCase();
  let si = 0;
  let prev = -2;
  let run = 0;
  let raw = 0;
  for (let i = 0; i < q.length; i++) {
    const at = s.indexOf(q[i], si);
    if (at === -1) return 0;
    let pts = 1;
    if (at === prev + 1) {
      run += 1;
      pts += 1.5 + Math.min(2, run * 0.5); // consecutive-run bonus
    } else {
      run = 0;
    }
    if (at === 0) pts += 2.5; // start-of-label bonus
    else if (s[at - 1] === " " || s[at - 1] === "-") pts += 2; // word start
    pts -= Math.min(1.5, (at - si) * 0.08); // gap penalty
    raw += Math.max(0.1, pts);
    prev = at;
    si = at + 1;
  }
  let score = raw / q.length / 4.6; // 4.6 ≈ best realistic per-char points
  score *= 0.72 + 0.28 * Math.min(1, q.length / 6); // longer query = confidence
  return Math.min(1, Math.max(0.05, score));
}

function rGoal(score: number, id: string) {
  return R_MIN + (1 - score) * R_SPAN + (hash01(id) - 0.5) * 24;
}

function currentTarget(o: Orbit, now: number) {
  return o.gFrom + (o.gTo - o.gFrom) * glideEase((now - o.gStart) / GLIDE_MS);
}

// --------------------------- token derivation ------------------------------
function parseHex(v: string): RGB | null {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readTokens(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const read = (name: string, fallback: RGB): RGB =>
    parseHex(cs.getPropertyValue(name)) ?? fallback;
  return {
    fg: read("--foreground", [237, 237, 237]),
    accent: read("--ns-accent", [0, 107, 255]),
    border: read("--border", [46, 46, 46]),
  };
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const DEFAULT_COMMANDS: CommandItem[] = [
  { id: "deploy-prod", label: "Deploy to production", category: "deploy" },
  { id: "deploy-preview", label: "Deploy preview branch", category: "deploy" },
  { id: "deploy-rollback", label: "Rollback deployment", category: "deploy" },
  { id: "repo-branch", label: "Create branch", category: "repo" },
  { id: "repo-pr", label: "Open pull request", category: "repo" },
  { id: "repo-search", label: "Search repository", category: "repo" },
  { id: "ws-theme", label: "Toggle dark theme", category: "workspace" },
  { id: "ws-settings", label: "Open settings", category: "workspace" },
];

// ---------------------------------------------------------------------------
export function EventHorizonCommand({
  commands = DEFAULT_COMMANDS,
  placeholder = "Type a command",
  defaultOpen = true,
  closeOnSelect = false,
  onSelect,
  onOpenChange,
  autoTypeQuery,
  autoTypeLoopMs = 6000,
  className = "h-[560px]",
}: {
  /** the searchable commands */
  commands?: CommandItem[];
  /** input placeholder text */
  placeholder?: string;
  /** palette starts open; ⌘K / Ctrl+K toggles, Esc closes */
  defaultOpen?: boolean;
  /** close the palette after a command is consumed */
  closeOnSelect?: boolean;
  /** called with the chosen command when one is selected */
  onSelect?: (item: CommandItem) => void;
  /** called with the new open state after ⌘K/Ctrl+K, Esc, or a selection */
  onOpenChange?: (open: boolean) => void;
  /** demo scripting: auto-types this query character by character, looping */
  autoTypeQuery?: string;
  /** loop period for the auto-typed query, ms */
  autoTypeLoopMs?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const baseId = useId();
  const listId = `${baseId}-listbox`;

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pillRefs = useRef(new Map<string, HTMLDivElement>());
  // lazily-measured pill half-size, used to keep labels clear of the input
  const pillSizeRef = useRef(new Map<string, { hw: number; hh: number }>());
  const orbitRef = useRef(new Map<string, Orbit>());
  const clearScriptRef = useRef<(() => void) | null>(null);
  const scriptStoppedRef = useRef(false);

  const [openState, setOpenState] = useState(defaultOpen);
  const [reduced, setReduced] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const itemsById = useMemo(() => {
    const m = new Map<string, CommandItem>();
    for (const c of commands) m.set(c.id, c);
    return m;
  }, [commands]);

  const results = useMemo<Scored[]>(() => {
    if (!query.trim()) {
      // empty query = NEUTRAL: everything orbits calmly. Scores are staggered
      // across a band so radii (and thus Kepler speeds) differ per command —
      // distinct omegas shear initial clusters apart into even spacing.
      const n = Math.max(1, commands.length - 1);
      return commands.map((item, i) => ({
        item,
        score: 0.62 - (0.34 * i) / n,
      }));
    }
    return commands
      .map((item) => ({ item, score: fuzzyScore(query, item.label) }))
      .filter((s) => s.score >= UNSTABLE_BELOW)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  }, [commands, query]);

  const activeIdx = results.length
    ? Math.min(highlight, results.length - 1)
    : -1;
  const active = activeIdx >= 0 ? results[activeIdx] : undefined;

  // latest values for the rAF loop — refs only on the hot path
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const consumedRef = useRef<(id: string) => void>(() => {});
  consumedRef.current = (id: string) => {
    const item = itemsById.get(id);
    if (item) onSelect?.(item);
    setQuery("");
    setHighlight(0);
    if (closeOnSelect) {
      setOpenState(false);
      onOpenChange?.(false);
    }
  };

  // ---------------------------------------------------------------- reduced
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ------------------------------------------------------------ ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenState((o) => {
          onOpenChange?.(!o);
          return !o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  // ------------------------------------------------------------- focus open
  useEffect(() => {
    if (openState) inputRef.current?.focus();
  }, [openState, reduced]);

  // ------------------------------------------------------- orbit sync layer
  // Keystroke re-scores: retarget survivors (glided over 450 ms), spawn new
  // entries falling in from outside, mark the dropped ones unstable.
  useEffect(() => {
    if (reduced || !openState) return;
    const map = orbitRef.current;
    const now = performance.now();
    const live = new Set<string>();
    results.forEach((res, i) => {
      live.add(res.item.id);
      const goal = rGoal(res.score, res.item.id);
      let o = map.get(res.item.id);
      if (!o) {
        o = {
          id: res.item.id,
          mode: "active",
          r: goal + 140,
          vr: 0,
          theta: i * GOLDEN + hash01(res.item.id) * 0.6, // sunflower spread
          gFrom: goal,
          gTo: goal,
          gStart: now - GLIDE_MS,
          alpha: 0,
          scale: 1,
          dieStart: 0,
          consumeStart: 0,
          px: 0,
          py: 0,
          hasPrev: false,
        };
        map.set(res.item.id, o);
        return;
      }
      if (o.mode === "dying" || o.mode === "hidden") {
        if (o.alpha <= 0.02) {
          o.r = goal + 140;
          o.vr = 0;
          o.hasPrev = false;
        }
        o.mode = "active";
      }
      if (o.mode !== "consuming") {
        o.gFrom = currentTarget(o, now);
        o.gTo = goal;
        o.gStart = now;
      }
    });
    for (const o of map.values()) {
      if (!live.has(o.id) && o.mode === "active") {
        o.mode = "dying";
        o.dieStart = now;
      }
    }
  }, [results, openState, reduced]);

  const beginConsume = (id: string) => {
    const o = orbitRef.current.get(id);
    if (o && o.mode === "active") {
      o.mode = "consuming";
      o.consumeStart = performance.now();
    }
  };

  // ------------------------------------------------------------ main rAF sim
  useEffect(() => {
    if (!openState || reduced) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Trails live as a segment list redrawn each frame with time-based alpha —
    // never an accumulation canvas: 8-bit destination-in fades quantize to a
    // permanent residue floor. Age-pruned segments provably reach zero, and
    // stale ink vanishes on the first frame after the loop wakes from a sleep.
    type Seg = { x0: number; y0: number; x1: number; y1: number; a0: number; born: number };
    let segs: Seg[] = [];

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let visible = true;
    let smoothConf = 0.5;
    let flash = 0; // accent pulse on consumption
    let colors = readTokens(root);
    // input's own footprint (half-extents), so orbiting labels can be kept
    // clear of it — re-measured on resize, not per-frame (layout is static
    // between resizes: fixed width/padding, so no per-frame reflow cost)
    let inputHalfW = 0;
    let inputHalfH = 0;
    const dampC = 2 * ZETA * Math.sqrt(SPRING_K);

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      segs = [];
      const inputRect = inputRef.current?.getBoundingClientRect();
      inputHalfW = inputRect ? inputRect.width / 2 : 0;
      inputHalfH = inputRect ? inputRect.height / 2 : 0;
    };
    resize();

    // theme flips re-derive every drawn color live (screenshot gate: both themes)
    const mo = new MutationObserver(() => {
      colors = readTokens(root);
      segs = [];
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      raf = visible ? requestAnimationFrame(loop) : 0;
      if (w < 8 || h < 8) return; // zero-size container guard

      const cx = w / 2;
      const cy = h / 2;
      // squash orbits to fit the container; guarded well above zero
      const sx = Math.min(1, Math.max(0.05, (w / 2 - 130) / FIT_REF));
      const sy = Math.min(1, Math.max(0.05, (h / 2 - 60) / FIT_REF));

      // ------------------------------------------------------------- orbits
      for (const o of orbitRef.current.values()) {
        if (o.mode === "hidden") continue;

        if (o.mode === "active") {
          const target = currentTarget(o, now);
          o.vr += (SPRING_K * (target - o.r) - dampC * o.vr) * dt;
          o.r += o.vr * dt;
          o.alpha = Math.min(1, o.alpha + dt / 0.3);
          o.scale = 1;
          o.theta += 1.6 * Math.sqrt(120 / Math.max(20, o.r)) * dt;
        } else if (o.mode === "dying") {
          // unstable orbit: outward acceleration + fade, then despawn
          o.vr += FLING_ACCEL * dt;
          o.r += o.vr * dt;
          o.theta += 1.6 * Math.sqrt(120 / Math.max(20, o.r)) * dt;
          o.alpha -= dt / FADE_S;
          if (o.alpha <= 0) {
            // fade complete -> despawn: hidden pills also leave the hit-test
            // layer so a stale position can never be clicked
            o.mode = "hidden";
            o.alpha = 0;
            o.hasPrev = false;
            const el = pillRefs.current.get(o.id);
            if (el) {
              el.style.opacity = "0";
              el.style.visibility = "hidden";
            }
            continue;
          }
        } else {
          // consuming: radius decays exp(-t/120ms) into the horizon
          o.r *= Math.exp(-dt / CONSUME_R_TAU);
          o.theta += 1.6 * Math.sqrt(120 / Math.max(12, o.r)) * dt;
          const p = Math.min(1, (now - o.consumeStart) / CONSUME_MS);
          o.alpha = 1 - p;
          o.scale = 1 - 0.4 * p;
          if (p >= 1) {
            o.mode = "hidden";
            o.alpha = 0;
            o.hasPrev = false;
            flash = 1;
            const el = pillRefs.current.get(o.id);
            if (el) {
              el.style.opacity = "0";
              el.style.visibility = "hidden";
            }
            consumedRef.current(o.id); // onSelect fires at consumption
            continue;
          }
        }

        // ox/oy are offsets from the field center; x/y absolute canvas coords
        const ox = Math.cos(o.theta) * o.r * sx;
        const oy = Math.sin(o.theta) * o.r * sy;
        const x = cx + ox;
        const y = cy + oy;

        if (o.hasPrev && o.alpha > 0.02) {
          const dx = x - o.px;
          const dy = y - o.py;
          const d2 = dx * dx + dy * dy;
          if (d2 > 2 && d2 < 120 * 120) {
            segs.push({ x0: o.px, y0: o.py, x1: x, y1: y, a0: TRAIL_ALPHA * o.alpha, born: now });
          }
        }
        o.px = x;
        o.py = y;
        o.hasPrev = true;

        // pills are anchored at left-1/2 top-1/2, so they get the OFFSET
        // (feeding absolute coords would double the center and pile every
        // pill into the bottom-right corner)
        const el = pillRefs.current.get(o.id);
        if (el) {
          // keep-out: the input sits centered on the same origin the pills
          // orbit around, so any pill whose orbit swings through the
          // horizontal band behind it would render with its label clipped
          // under the input chrome. Nudge the LABEL (not the physics
          // ox/oy above, which stay true for the trail) just clear of the
          // input's measured footprint — orbit radius/speed are untouched.
          let labelOx = ox;
          let labelOy = oy;
          if (inputHalfW > 0) {
            let size = pillSizeRef.current.get(o.id);
            if (!size) {
              size = { hw: el.offsetWidth / 2, hh: el.offsetHeight / 2 };
              if (size.hw > 0 && size.hh > 0) pillSizeRef.current.set(o.id, size);
            }
            const clearW = inputHalfW + size.hw;
            const clearH = inputHalfH + size.hh + 4; // small breathing gap
            if (Math.abs(labelOx) < clearW && Math.abs(labelOy) < clearH) {
              labelOy = (labelOy < 0 ? -1 : 1) * clearH;
            }
          }
          el.style.opacity = o.alpha.toFixed(3);
          el.style.visibility = "visible";
          el.style.transform = `translate(-50%,-50%) translate3d(${labelOx.toFixed(2)}px,${labelOy.toFixed(2)}px,0) scale(${o.scale.toFixed(3)})`;
        }
      }

      // ------------------------------------------------------- canvas paint
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // horizon boundary: the tightest possible orbit
      ctx.strokeStyle = rgba(colors.border, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R_MIN * sx, R_MIN * sy, 0, 0, Math.PI * 2);
      ctx.stroke();

      // trails: each segment fades exp(-age / 0.24 s) and is pruned once
      // invisible or older than 1 s — ink fully dissolves, nothing accumulates
      if (segs.length > TRAIL_CAP) segs.splice(0, segs.length - TRAIL_CAP);
      if (segs.length) {
        const keep: Seg[] = [];
        for (const s of segs) {
          const age = (now - s.born) / 1000;
          const a = s.a0 * Math.exp(-age / TRAIL_TAU);
          if (age > TRAIL_MAX_AGE || a < 0.012) continue;
          keep.push(s);
          ctx.strokeStyle = rgba(colors.fg, a);
          ctx.beginPath();
          ctx.moveTo(s.x0, s.y0);
          ctx.lineTo(s.x1, s.y1);
          ctx.stroke();
        }
        segs = keep;
      }

      // query-confidence mass (mean top-3 score) breathes the glow 24-48 px
      const rs = resultsRef.current;
      let conf = 0;
      const n = Math.min(3, rs.length);
      for (let i = 0; i < n; i++) conf += rs[i].score;
      conf = n > 0 ? conf / n : 0;
      smoothConf += (conf - smoothConf) * Math.min(1, dt * 5);
      flash = Math.max(0, flash - dt / 0.45);

      const glowR = 24 + Math.min(1, Math.max(0, smoothConf)) * 24;
      const ink = mixRGB(colors.fg, colors.accent, flash);
      const outer = glowR * 2.4;
      const grd = ctx.createRadialGradient(cx, cy, glowR * 0.25, cx, cy, outer);
      grd.addColorStop(0, rgba(ink, 0.34 + 0.36 * flash));
      grd.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(cx - outer, cy - outer, outer * 2, outer * 2);
      ctx.strokeStyle = rgba(ink, 0.28 + 0.3 * smoothConf + 0.3 * flash);
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.stroke();
    };
    raf = requestAnimationFrame(loop);

    // ambient while open — but the loop pauses entirely offscreen
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && raf === 0) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      mo.disconnect();
      io.disconnect();
      ro.disconnect();
      orbitRef.current.clear();
    };
  }, [openState, reduced]);

  // ------------------------------------------------------ auto-type scripting
  useEffect(() => {
    if (!autoTypeQuery || !openState || reduced || scriptStoppedRef.current)
      return;
    const timers: number[] = [];
    const type = (delay: number, step: number) => {
      for (let i = 1; i <= autoTypeQuery.length; i++) {
        timers.push(
          window.setTimeout(() => {
            setQuery(autoTypeQuery.slice(0, i));
            setHighlight(0);
          }, delay + i * step)
        );
      }
    };
    const cycle = () => {
      timers.splice(0).forEach((t) => window.clearTimeout(t));
      setQuery(""); // brief calm-orbit beat between passes
      setHighlight(0);
      type(600, 160);
    };
    // first pass starts promptly (first char ~400 ms) so an early "default"
    // screenshot catches a mid-query state, not the idle placeholder
    type(250, 150);
    const iv = window.setInterval(cycle, Math.max(2000, autoTypeLoopMs));
    const stop = () => {
      window.clearInterval(iv);
      timers.splice(0).forEach((t) => window.clearTimeout(t));
    };
    clearScriptRef.current = stop;
    return () => {
      stop();
      clearScriptRef.current = null;
    };
  }, [autoTypeQuery, autoTypeLoopMs, openState, reduced]);

  const stopScript = () => {
    scriptStoppedRef.current = true;
    clearScriptRef.current?.();
  };

  // ----------------------------------------------------------------- handlers
  const closePalette = () => {
    setOpenState(false);
    onOpenChange?.(false);
  };

  const selectItem = (item: CommandItem) => {
    if (reduced) {
      onSelect?.(item);
      setQuery("");
      setHighlight(0);
      if (closeOnSelect) closePalette();
    } else {
      beginConsume(item.id);
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    stopScript();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active) selectItem(active.item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  };

  const activeOptionId = active ? `${baseId}-opt-${active.item.id}` : undefined;

  const comboboxProps = {
    role: "combobox" as const,
    "aria-expanded": true,
    "aria-controls": listId,
    "aria-activedescendant": activeOptionId,
    "aria-autocomplete": "list" as const,
    autoComplete: "off",
    spellCheck: false,
  };

  const optionRows = results.map((res, i) => (
    <li
      key={res.item.id}
      id={`${baseId}-opt-${res.item.id}`}
      role="option"
      aria-selected={i === activeIdx}
      onClick={() => selectItem(res.item)}
      className={
        reduced
          ? `flex cursor-pointer items-center justify-between px-4 py-2 text-sm transition-colors ${
              i === activeIdx
                ? "bg-background text-foreground"
                : "text-ns-muted hover:bg-background/60 hover:text-foreground"
            }`
          : undefined
      }
    >
      <span>{res.item.label}</span>
      {res.item.category ? (
        <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">
          {res.item.category}
        </span>
      ) : null}
    </li>
  ));

  return (
    <div ref={rootRef} className={`relative w-full overflow-hidden ${className}`}>
      {openState ? (
        <div
          role="dialog"
          aria-label="Command palette"
          className="absolute inset-0"
          onKeyDown={(e) => {
            // focus trap: the input is the palette's single tab stop
            if (e.key === "Tab") {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          {reduced ? (
            // static fallback: plain ranked listbox, zero canvas, zero motion
            <div className="absolute left-1/2 top-1/2 w-80 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface shadow-lg">
              <input
                ref={inputRef}
                {...comboboxProps}
                value={query}
                placeholder={placeholder}
                aria-label="Search commands"
                onChange={(e) => {
                  stopScript();
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onInputKeyDown}
                className="w-full rounded-t-md border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-ns-muted focus:border-ns-accent/60"
              />
              <ul
                id={listId}
                role="listbox"
                aria-label="Commands"
                className="max-h-80 overflow-y-auto py-1"
              >
                {optionRows}
              </ul>
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              {/* orbiting label pills — presentational; the sr-only listbox
                  below is the accessible surface */}
              {commands.map((c) => (
                <div
                  key={c.id}
                  ref={(el) => {
                    if (el) pillRefs.current.set(c.id, el);
                    else pillRefs.current.delete(c.id);
                  }}
                  aria-hidden
                  onClick={() => selectItem(c)}
                  className={`absolute left-1/2 top-1/2 flex cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-full border bg-surface/85 px-3 py-1 backdrop-blur-sm transition-colors will-change-transform ${
                    active?.item.id === c.id
                      ? "border-ns-accent ring-1 ring-ns-accent"
                      : "border-border hover:border-foreground/30"
                  }`}
                  style={{
                    opacity: 0,
                    visibility: "hidden",
                    transform: "translate(-50%,-50%)",
                  }}
                >
                  <span className="text-xs text-foreground">{c.label}</span>
                  {c.category ? (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">
                      {c.category}
                    </span>
                  ) : null}
                </div>
              ))}
              <div className="absolute left-1/2 top-1/2 z-10 w-72 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2">
                <input
                  ref={inputRef}
                  {...comboboxProps}
                  value={query}
                  placeholder={placeholder}
                  aria-label="Search commands"
                  onChange={(e) => {
                    stopScript();
                    setQuery(e.target.value);
                    setHighlight(0);
                  }}
                  onKeyDown={onInputKeyDown}
                  className="w-full rounded-full border border-border bg-surface/90 px-5 py-2.5 text-sm text-foreground shadow-lg outline-none backdrop-blur transition-colors placeholder:text-ns-muted focus:border-ns-accent/60 focus:ring-2 focus:ring-ns-accent/25"
                />
                <ul id={listId} role="listbox" aria-label="Commands" className="sr-only">
                  {optionRows}
                </ul>
                <p className="pointer-events-none absolute left-0 right-0 top-full mt-3 text-center font-mono text-[10px] tracking-widest text-ns-muted">
                  &uarr;&darr; orbit &middot; &crarr; consume &middot; esc close
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpenState(true);
            onOpenChange?.(true);
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-surface px-3 py-1.5 font-mono text-xs text-ns-muted transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          <kbd className="mr-2 rounded-sm border border-border px-1">&#8984;K</kbd>
          open command palette
        </button>
      )}
    </div>
  );
}
