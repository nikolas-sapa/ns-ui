"use client";

import { useLayoutEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// JominyQuench — a hardenability comparison card built on the real ASTM A255
// / ISO 642 Jominy end-quench test: a bar is austenitised, then a water jet is
// sprayed against ONE end only. The quenched face cools fastest and hardens
// most; hardness falls off with distance from that face along a curve that is
// the alloy's signature. Comparing several bars means comparing several
// fall-off curves — that IS the mechanic, not a metaphor bolted onto one.
//
// Each row runs the same fixed cycle: the bar reheats to a uniform glow, a
// quench front creeps left-to-right across it while the water jet continuously
// sprays the left face (a steam plume that never stops), the fall-off curve
// above the bar draws in step with the front, then a hold at full quench
// before the next reheat. Rows are phase-staggered so the cascade never
// settles into one static pose.
//
// Distinctness: weld-pool is a continuously MOLTEN free surface with no
// directional solidification front; kamacite-etch reveals an already-formed
// static crystal lattice with no cooling physics at all. This is a
// directional, one-axis COOLING front with a hardness fall-off curve as its
// output — a different physical process from both.
//
// LUMINANCE ADAPTATION: the real test is intensely hue-coded (quenched steel
// runs white -> yellow -> orange -> red -> black as it cools) but this
// registry is five value-only tokens with no orange. Temperature is mapped to
// luminance instead: the hottest, most salient point on the bar is always
// closest to --foreground (the token with maximum contrast against
// --background) and the coldest, quenched point always fades toward
// --background. That mapping self-inverts correctly between themes, because
// "closest to --foreground" already means "near-white ink on a dark ground"
// in dark theme and "near-black ink on a light ground" in light theme — hot
// is unambiguously the salient value in both.
//
// Colour is read once via getComputedStyle(document.documentElement) and
// re-read on a MutationObserver watching documentElement's class, matching
// every other canvas component in this registry (duplicated here on purpose —
// no shared lib/ helper). Direct-DOM rAF, DPR-capped backing store,
// IntersectionObserver + visibilitychange pause. --ns-accent appears only as
// the hover/focus highlight on a compared bar's row — never in the resting
// glow ramp.
// ---------------------------------------------------------------------------

export interface JominyBar {
  id: string;
  /** alloy / grade name, e.g. "4140" */
  name: string;
  /**
   * Rockwell-C hardness at each of the nine standard Jominy distances
   * (DISTANCE_LABELS: 1/16" through 2"), quenched face first. Supply fewer
   * values than the header shows and the table renders that many cells
   * against the full nine-column header — pass one entry per label to
   * avoid a mismatched row.
   */
  hardness: number[];
}

const DISTANCES_16THS = [1, 2, 4, 6, 8, 12, 16, 24, 32];
const DISTANCE_LABELS = DISTANCES_16THS.map((n) =>
  n < 16 ? `${n}/16″` : `${n / 16}″`
);

// Illustrative Jominy-curve shapes (plain-carbon vs. low/medium alloy vs.
// spring steel) — the real published J-curves for these grades vary by heat
// and mill; these are shaped to the well-documented qualitative behavior
// (more alloy content = flatter fall-off) rather than lifted from one cert
// sheet, and are labelled as such in meta.json.
const DEFAULT_BARS: JominyBar[] = [
  { id: "1045", name: "1045", hardness: [55, 50, 36, 28, 24, 22, 21, 20, 20] },
  { id: "5160", name: "5160", hardness: [58, 55, 48, 42, 37, 32, 29, 26, 24] },
  { id: "8640", name: "8640", hardness: [56, 55, 53, 51, 49, 46, 44, 41, 38] },
  { id: "4140", name: "4140", hardness: [58, 56, 53, 50, 47, 43, 40, 36, 33] },
];

// cycle phase fractions (of CYCLE_MS): reheat, quench-creep, hold
const RISE_FRAC = 0.1;
const QUENCH_FRAC = 0.58;
// HOLD_FRAC = 1 - RISE_FRAC - QUENCH_FRAC = 0.32
const CYCLE_MS = 7200;
const PHASE_STAGGER = 0.16; // per-row offset, decorrelates the cascade

const COLD_BASE = 0.15; // heat level immediately behind the front — still a hole, but not invisible
const RESIDUAL_ASYMPTOTE = 0.9; // heat level the ahead-of-front zone recovers to, short of full furnace heat
const DIP_DEPTH = 0.35; // how far below the asymptote the zone right at the front dips
const DIP_WIDTH = 0.14; // fraction of bar length the dip recovers over, ahead of the front
const FRONT_BLEND = 0.05; // fraction of bar length the front edge is soft over
const STATIC_FRONT = 0.55; // reduced-motion freeze: partway up the bar
const STATIC_CURVE_REVEAL = 1; // ...with the full signature curve drawn

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * c, a[1] + (b[1] - a[1]) * c, a[2] + (b[2] - a[2]) * c];
}

function rgbStr([r, g, b]: RGB, a = 1): string {
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// Heat level 0..1 at bar-fraction x for a given front position, ignoring the
// reheat blend — this is the "just been quenched to here" profile: cold
// behind the front, a soft transition band, then a dip right at the boundary
// (the metal there has only just started losing heat to the jet) that
// recovers toward RESIDUAL_ASYMPTOTE as x moves away from the front — i.e.
// the unquenched material farthest from where cooling is currently happening
// is the material that has lost the least heat, which is the residual glow
// the far end is meant to retain.
function frontHeat(x: number, front: number): number {
  const d = x - front;
  if (d <= -FRONT_BLEND) return COLD_BASE;
  const da = Math.max(0, d);
  const aheadVal = RESIDUAL_ASYMPTOTE - DIP_DEPTH * Math.exp(-da / DIP_WIDTH);
  if (d >= FRONT_BLEND) return aheadVal;
  const s = smoothstep((d + FRONT_BLEND) / (2 * FRONT_BLEND));
  return COLD_BASE + (aheadVal - COLD_BASE) * s;
}

type Phase = { front: number; curveReveal: number; reheat: number };

function phaseAt(u: number): Phase {
  const t = ((u % 1) + 1) % 1;
  if (t < RISE_FRAC) {
    const q = smoothstep(t / RISE_FRAC);
    return { front: 1, curveReveal: 1 - q, reheat: q };
  }
  const t2 = t - RISE_FRAC;
  if (t2 < QUENCH_FRAC) {
    const q = smoothstep(t2 / QUENCH_FRAC);
    return { front: q, curveReveal: q, reheat: 0 };
  }
  return { front: 1, curveReveal: 1, reheat: 0 };
}

// During "rise" (reheat), the whole bar blends from wherever the last
// quench left it back toward a uniform hot glow, so the bar never snaps —
// it visibly warms back up before the next front starts creeping.
function heatAt(x: number, ph: Phase): number {
  const front = frontHeat(x, ph.front);
  return ph.reheat > 0 ? front + (1 - front) * ph.reheat : front;
}

export interface JominyQuenchProps {
  /** bars being compared, quenched-face-first hardness per bar */
  bars?: JominyBar[];
  /** accessible title for the comparison */
  title?: string;
  className?: string;
}

export function JominyQuench({
  bars = DEFAULT_BARS,
  title = "Jominy end-quench hardenability",
  className = "",
}: JominyQuenchProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<number>(-1);
  // set only under prefers-reduced-motion, where nothing else repaints the
  // canvas — lets hover/focus still redraw the accent highlight on demand
  const hoverRedrawRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const n = bars.length;
    const maxHRC = Math.max(1, ...bars.flatMap((b) => b.hardness)) * 1.08;
    const nPts = Math.max(2, ...bars.map((b) => b.hardness.length));

    let width = 0;
    let rowH = 0;
    let dpr = 1;
    let padX = 26;

    // Token fields start empty and are only ever assigned from a live
    // getComputedStyle read — never a hardcoded fallback — so a missing
    // token fails loud (drawFrame bails) instead of silently painting a
    // baked-in white.
    let bgC: RGB | null = null;
    let fgC: RGB | null = null;
    let mutedC: RGB | null = null;
    let accentC: RGB | null = null;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const get = (name: string) => cs.getPropertyValue(name).trim();
      bgC = parseHex(get("--background"));
      fgC = parseHex(get("--foreground"));
      mutedC = parseHex(get("--ns-muted"));
      accentC = parseHex(get("--ns-accent"));
    };
    readTokens();

    const resize = () => {
      const rect = root.getBoundingClientRect();
      width = rect.width;
      // rowH derives from the container's own width (the reliably-available
      // "small dimension" for a full-width stacked-row card): clamped so the
      // bar, curve and plume stay legible at small preview-card widths
      // instead of shrinking to illegibility or ballooning on a wide column.
      rowH = Math.max(48, Math.min(84, width * 0.15));
      // the plume's footprint (jet length + puff radius) scales with bar
      // thickness, which scales with rowH — a fixed left margin clips the
      // jet/puffs off-canvas at large rowH, so the margin is derived from
      // the same thickness the plume actually draws at.
      const thick = Math.max(5, Math.min(13, rowH * 0.15));
      padX = Math.max(26, thick * 3.4);
      const height = rowH * n;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.height = `${height}px`;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();

    let raf = 0;
    let visible = true;
    let t0 = performance.now();

    const drawPlume = (cx: number, cy: number, thick: number, tSec: number, fg: RGB) => {
      // continuous jet + steam plume at the quenched face — never stops, not
      // tied to the quench-cycle phase, only to elapsed real time
      const jetLen = thick * 2.6;
      ctx.strokeStyle = rgbStr(fg, 0.28);
      ctx.lineWidth = Math.max(1, thick * 0.22);
      ctx.beginPath();
      const jitter = Math.sin(tSec * 26) * 1.1 + Math.sin(tSec * 41 + 1.7) * 0.6;
      ctx.moveTo(cx - jetLen, cy - thick * 1.6 + jitter);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      const puffs = 4;
      for (let i = 0; i < puffs; i++) {
        const ph = (tSec * 0.55 + i / puffs) % 1;
        const rise = ph * thick * 3.2;
        const wob = Math.sin(tSec * 3.1 + i * 2.3) * thick * 0.35;
        const r = thick * (0.35 + ph * 0.55);
        const a = 0.16 * (1 - ph);
        ctx.fillStyle = rgbStr(fg, a);
        ctx.beginPath();
        ctx.arc(cx - jetLen * 0.35 + wob, cy - thick * 1.3 - rise, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawRow = (
      i: number,
      ph: Phase,
      isStatic: boolean,
      bg: RGB,
      fg: RGB,
      muted: RGB,
      accent: RGB
    ) => {
      const bar = bars[i];
      const rowTop = i * rowH;
      const curveTop = rowTop + rowH * 0.08;
      const curveBaseline = rowTop + rowH * 0.56;
      const curveMaxH = curveBaseline - curveTop;
      const barThick = Math.max(5, Math.min(13, rowH * 0.15));
      const barY = curveBaseline + barThick * 1.35;
      const barLeft = padX;
      const barRight = width - padX * 0.6;
      const barLen = Math.max(1, barRight - barLeft);

      const hovered = hoverRef.current === i;

      // bar fill: horizontal gradient sampled from the heat profile so the
      // cooled/quenched zone visibly recedes toward --background and the
      // still-hot zone reads as the salient --foreground-leaning value
      const grad = ctx.createLinearGradient(barLeft, 0, barRight, 0);
      const STOPS = 20;
      for (let s = 0; s <= STOPS; s++) {
        const x = s / STOPS;
        const heat = heatAt(x, ph);
        grad.addColorStop(x, rgbStr(lerpRGB(bg, fg, heat)));
      }
      ctx.fillStyle = grad;
      const r = barThick / 2;
      ctx.beginPath();
      ctx.moveTo(barLeft + r, barY - r);
      ctx.arcTo(barRight, barY - r, barRight, barY + r, r);
      ctx.arcTo(barRight, barY + r, barLeft, barY + r, r);
      ctx.arcTo(barLeft, barY + r, barLeft, barY - r, r);
      ctx.arcTo(barLeft, barY - r, barRight, barY - r, r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hovered ? rgbStr(accent, 0.85) : rgbStr(fg, 0.22);
      ctx.lineWidth = hovered ? 1.6 : 1;
      ctx.stroke();

      // quench front marker — only visible mid-creep, the literal directional
      // cooling boundary this mechanic is named for
      if (ph.front > 0.004 && ph.front < 0.996) {
        const fx = barLeft + barLen * ph.front;
        ctx.strokeStyle = rgbStr(fg, 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, curveBaseline);
        ctx.lineTo(fx, barY + barThick);
        ctx.stroke();
      }

      // fall-off curve — this alloy's signature, drawn point-to-point,
      // clipped to curveReveal so it fills in as the front reaches each x
      const pts: [number, number][] = bar.hardness.map((h, k) => {
        const x = barLeft + (barLen * k) / (nPts - 1);
        const y = curveBaseline - (h / maxHRC) * curveMaxH * 0.94;
        return [x, y];
      });
      const revealX = barLeft + barLen * ph.curveReveal;

      ctx.beginPath();
      ctx.moveTo(pts[0][0], curveBaseline);
      let leadX = pts[0][0];
      let leadY = pts[0][1];
      ctx.lineTo(leadX, leadY);
      for (let k = 1; k < pts.length; k++) {
        const [px, py] = pts[k];
        if (px <= revealX) {
          ctx.lineTo(px, py);
          leadX = px;
          leadY = py;
        } else {
          const [ppx, ppy] = pts[k - 1];
          const seg = (revealX - ppx) / Math.max(1e-3, px - ppx);
          if (seg > 0) {
            leadX = ppx + (px - ppx) * seg;
            leadY = ppy + (py - ppy) * seg;
            ctx.lineTo(leadX, leadY);
          }
          break;
        }
      }
      ctx.lineTo(leadX, curveBaseline);
      ctx.closePath();
      ctx.fillStyle = rgbStr(muted, hovered ? 0.14 : 0.08);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      let lx = pts[0][0];
      let ly = pts[0][1];
      for (let k = 1; k < pts.length; k++) {
        const [px, py] = pts[k];
        if (px <= revealX) {
          ctx.lineTo(px, py);
          lx = px;
          ly = py;
        } else {
          const [ppx, ppy] = pts[k - 1];
          const seg = (revealX - ppx) / Math.max(1e-3, px - ppx);
          if (seg > 0) {
            lx = ppx + (px - ppx) * seg;
            ly = ppy + (py - ppy) * seg;
            ctx.lineTo(lx, ly);
          }
          break;
        }
      }
      ctx.strokeStyle = rgbStr(fg, hovered ? 1 : 0.85);
      ctx.lineWidth = hovered ? 2 : 1.4;
      ctx.stroke();

      // the "pen" — a lead dot at the point currently being drawn, only while
      // actively creeping (not once the curve is fully settled)
      if (ph.curveReveal > 0.003 && ph.curveReveal < 0.997) {
        ctx.fillStyle = rgbStr(fg, 0.9);
        ctx.beginPath();
        ctx.arc(lx, ly, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }

      const tSec = isStatic ? 0 : (performance.now() - t0) / 1000;
      drawPlume(barLeft, barY, barThick, tSec, fg);
    };

    const drawFrame = (isStatic: boolean) => {
      // tokens are only ever assigned from a live read (never a hardcoded
      // fallback) — a genuinely missing token bails the paint rather than
      // silently substituting a baked-in colour.
      if (!bgC || !fgC || !mutedC || !accentC) return;
      const bg = bgC;
      const fg = fgC;
      const muted = mutedC;
      const accent = accentC;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, rowH * n);
      ctx.fillStyle = rgbStr(bg);
      ctx.fillRect(0, 0, width, rowH * n);

      const now = isStatic ? 0 : (performance.now() - t0) / CYCLE_MS;
      for (let i = 0; i < n; i++) {
        const ph = isStatic
          ? { front: STATIC_FRONT, curveReveal: STATIC_CURVE_REVEAL, reheat: 0 }
          : phaseAt(now + i * PHASE_STAGGER);
        drawRow(i, ph, isStatic, bg, fg, muted, accent);
      }
      ctx.restore();
    };

    const loop = () => {
      drawFrame(false);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      drawFrame(true);
      hoverRedrawRef.current = () => drawFrame(true);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      drawFrame(reduced);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      const vis = entries[0]?.isIntersecting ?? true;
      if (vis === visible) return;
      visible = vis;
      if (reduced) return;
      if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && !raf) {
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    const onVis = () => {
      if (reduced) return;
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!document.hidden && visible && !raf) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      drawFrame(reduced);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      hoverRedrawRef.current = null;
    };
    // bars/n/maxHRC are derived once at mount from the bars prop, matching
    // every other canvas component's closure-locals convention
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);

  const setHover = (i: number) => {
    hoverRef.current = i;
    hoverRedrawRef.current?.();
  };
  const clearHover = (i: number) => {
    if (hoverRef.current === i) hoverRef.current = -1;
    hoverRedrawRef.current?.();
  };

  return (
    <div ref={rootRef} className={`w-full text-foreground ${className}`.trim()}>
      {/* no bg-surface here — the canvas fills --background itself every
          frame, and --surface is a different token, so a wrapper fill would
          leave a visible seam inside the border */}
      <div className="relative w-full overflow-hidden rounded-md border border-border">
        <canvas ref={canvasRef} aria-hidden className="block w-full" />
      </div>

      <table className="mt-4 w-full border-collapse">
        <caption className="sr-only">
          {title} — Rockwell C hardness at each distance from the quenched face
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-1.5 pr-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-ns-muted">
              Grade
            </th>
            {DISTANCE_LABELS.map((d) => (
              <th
                key={d}
                scope="col"
                className="py-1.5 px-1.5 text-right font-mono text-[10px] font-normal text-ns-muted"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bars.map((bar, i) => (
            <tr key={bar.id} className="border-b border-border/60 last:border-b-0">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                <button
                  type="button"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => clearHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => clearHover(i)}
                  className="rounded-sm text-[13px] leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                >
                  {bar.name}
                </button>
              </th>
              {bar.hardness.map((h, k) => (
                <td key={k} className="py-1.5 px-1.5 text-right font-mono text-[11px] tabular-nums text-foreground/90">
                  {h}
                  <span className="sr-only"> HRC</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default JominyQuench;
