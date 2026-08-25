"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// DividerPetsciiVu — a full-width section divider rendered as a PETSCII /
// C64-style reverse-video VU meter band.
//
// The discriminator against spectrogram-ascii-bands (this repo's nearest
// neighbour) is structural, not cosmetic: that component selects a glyph off
// a 10-step ' .:-=+*#%@' density ramp per cell — a continuous quantity. This
// component has exactly TWO states per cell — paper or ink, the literal C64
// "reverse" screen-code bit — and nothing in between. A cell is either an
// opaque --foreground rect (paper and ink swapped, the reverse-video toggle)
// or nothing at all (the page shows through as --background). No alpha
// buckets, no glyph substitution, no ramp.
//
// The analysis is real amplitude, not frequency content: an ANSI C16.5-style
// VU integrator (300 ms RMS time constant) over either a live AnalyserNode's
// waveform or a synthetic phrase, plus a fast-attack/slow-decay peak-hold
// column — the two pieces of ballistics an analog VU needle actually has.
// A slow AGC ceiling (fast attack toward louder peaks, slow release) keeps
// the meter self-normalizing regardless of the source's absolute level, the
// same discipline spectrogram-ascii-bands applies as a per-band noise FLOOR,
// mirrored here as a loudness CEILING because a VU meter's job is knowing
// how close to clipping it is, not how far above the noise floor.
// ---------------------------------------------------------------------------

const ROWS = 7;
const BLOCK_N = 512; // samples analysed per hop, real or synthetic
const HOP_MS = 30;
const DT_MAX = 0.25;
const MAX_HOPS_PER_FRAME = 6;

const RMS_TAU = 0.3; // s — the classic VU meter's 300ms integration time
const CEIL_RISE = 0.12; // per hop, toward a louder block (fast attack)
const CEIL_FALL = 0.0015; // per hop, toward a quieter ceiling (slow release)
const CEIL_MIN = 0.02; // floor under the AGC ceiling so silence can't divide by ~0
const GATE = 0.035; // normalized level below this lights nothing — real meters idle at zero

const PEAK_DECAY = 0.62; // level-fraction / s the hold marker falls back
const PEAK_HOLD_MS = 260; // dwell at the new peak before decay resumes

// segment gaps: every 4th column is a fixed dark gap, independent of level —
// the classic hardware LED bargraph look, and it keeps a fully-lit meter
// from ever reading as one solid rect
const GAP_STRIDE = 4;

const SYNTH_SR = 16000;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic stand-in for a source track: a bass pulse on a ~109bpm grid
 * (exponential-decay kick, syncopated accent pattern seeded per-hit) under a
 * slow 8.5s phrase swell crossed with a longer 21s breakdown gate that pulls
 * the whole thing to near-silence periodically — the "quiet stretches" that
 * keep the meter mostly at rest are baked into the source, not faked at the
 * display layer. Nothing here calls getUserMedia.
 */
function createSyntheticSource() {
  const rand = mulberry32(0x7a11c5);
  const dt = 1 / SYNTH_SR;
  let t = 0;
  let carrier = 0;
  let kickPhase = 1; // >= kickInterval triggers a new hit
  let kickEnv = 0;
  let kickAccent = 1;
  const kickInterval = 60 / 109 / 2; // eighth notes at 109bpm

  return (n: number) => {
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      t += dt;
      kickPhase += dt;
      if (kickPhase >= kickInterval) {
        kickPhase -= kickInterval;
        kickEnv = 1;
        // syncopation: every other eighth is a ghost hit, occasional accent
        const r = rand();
        kickAccent = r > 0.86 ? 1.2 : r > 0.5 ? 0.85 : 0.35;
      }
      kickEnv *= 0.9975; // ~150ms exponential decay at 16kHz
      const kick = kickAccent * kickEnv * Math.sin(2 * Math.PI * 72 * t);

      carrier += 2 * Math.PI * 220 * dt;
      const tone = 0.4 * Math.sin(carrier) * kickEnv;

      const phrase = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 8.5);
      const breakdown = Math.max(0, Math.sin((2 * Math.PI * t) / 21 - 0.6));
      const gain = 0.15 + 0.85 * phrase * breakdown;

      const s = (kick + tone) * gain;
      sumSq += s * s;
    }
    return sumSq / n;
  };
}

export interface DividerPetsciiVuProps {
  /**
   * Where samples come from: a live `AnalyserNode`, or a provider that fills
   * the passed Float32Array with the newest samples. Omitted ⇒ the built-in
   * deterministic synthetic phrase — never a getUserMedia prompt.
   */
  source?: AnalyserNode | ((out: Float32Array) => void);
  /** cell size in px; the band is ROWS (7) cells tall. Default 12. */
  cellSize?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function DividerPetsciiVu({
  source,
  cellSize = 12,
  className = "",
}: DividerPetsciiVuProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sampleRate =
      source instanceof AnalyserNode ? source.context.sampleRate : SYNTH_SR;
    const hopSamples = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));

    const synth = createSyntheticSource();
    const external =
      source instanceof AnalyserNode
        ? (() => {
            const buf = new Float32Array(source.fftSize);
            return (n: number) => {
              source.getFloatTimeDomainData(buf);
              const off = Math.max(0, buf.length - n);
              let sumSq = 0;
              for (let i = 0; i < n; i++) {
                const v = buf[off + i] ?? 0;
                sumSq += v * v;
              }
              return sumSq / n;
            };
          })()
        : typeof source === "function"
          ? (() => {
              const buf = new Float32Array(BLOCK_N);
              return (n: number) => {
                source(buf);
                let sumSq = 0;
                for (let i = 0; i < n; i++) {
                  const v = buf[i] ?? 0;
                  sumSq += v * v;
                }
                return sumSq / n;
              };
            })()
          : null;

    // -- ballistics state -----------------------------------------------------
    let rmsEnergy = 0; // exponentially integrated mean-square
    let ceiling = CEIL_MIN;
    let level = 0; // normalized 0..1, what the bar reads
    let peak = 0; // hold marker, normalized 0..1
    let peakHoldMs = 0;

    const hopRms = () => {
      const blockMS = external ? external(hopSamples) : synth(hopSamples);
      const alpha = 1 - Math.exp(-(HOP_MS / 1000) / RMS_TAU);
      rmsEnergy += (blockMS - rmsEnergy) * alpha;
      const raw = Math.sqrt(Math.max(0, rmsEnergy));

      // AGC ceiling: fast attack toward a louder block, slow release toward
      // a quieter one — the meter stays legible whether the source is a
      // whisper or hot, without ever being told its absolute scale
      ceiling =
        raw > ceiling
          ? ceiling + (raw - ceiling) * CEIL_RISE
          : Math.max(CEIL_MIN, ceiling + (raw - ceiling) * CEIL_FALL);

      const norm = Math.min(1, raw / ceiling);
      level = norm < GATE ? 0 : norm;

      if (level >= peak) {
        peak = level;
        peakHoldMs = PEAK_HOLD_MS;
      } else if (peakHoldMs > 0) {
        peakHoldMs -= HOP_MS;
      } else {
        peak = Math.max(level, peak - (PEAK_DECAY * HOP_MS) / 1000);
      }
    };

    // one warmup pass so the RMS/AGC pair is already settled — without it
    // the very first painted frame is silence climbing out of a cold
    // integrator, which is a dead band, not a VU meter at rest
    for (let i = 0; i < 40; i++) hopRms();

    // -- layout / tokens -------------------------------------------------------
    let fg = "currentColor";
    let cellW = cellSize * 0.6;
    const cellH = cellSize;
    let cols = 0;
    let sized = false;
    let disposed = false;

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    const resize = () => {
      const { width } = canvas.getBoundingClientRect();
      const height = ROWS * cellH;
      if (width < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fontFamily = getComputedStyle(canvas).fontFamily;
      const off = document.createElement("canvas").getContext("2d");
      if (off) {
        off.font = `${cellSize}px ${fontFamily}`;
        cellW = Math.max(4, off.measureText("MMMMMMMMMM").width / 10);
      }

      cols = Math.max(8, Math.floor(width / cellW));
      sized = true;
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * cellW + cellW, ROWS * cellH);

      const litCols = Math.min(cols, Math.round(level * cols));
      const peakCol = Math.min(cols - 1, Math.round(peak * cols));

      ctx.fillStyle = fg;
      for (let j = 0; j < cols; j++) {
        const isGap = j % GAP_STRIDE === GAP_STRIDE - 1;
        const lit = !isGap && j < litCols;
        const isPeakCol = j === peakCol && peak > GATE;
        if (!lit && !isPeakCol) continue;
        for (let r = 0; r < ROWS; r++) {
          // the peak-hold column is textured (checkerboard subset of rows)
          // rather than a solid fill — the same two-state ink/paper rule,
          // just a different SUBSET of cells lit, so it reads as a distinct
          // marker without ever introducing a third visual state
          if (isPeakCol && !lit && (r + j) % 2 !== 0) continue;
          ctx.fillRect(
            Math.round(j * cellW),
            r * cellH,
            Math.ceil(cellW) + 1,
            cellH
          );
        }
      }
    };

    // -- loop --------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let acc = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      acc += dt * 1000;
      let hops = 0;
      while (acc >= HOP_MS && hops < MAX_HOPS_PER_FRAME) {
        acc -= HOP_MS;
        hopRms();
        hops++;
      }
      if (acc > HOP_MS * MAX_HOPS_PER_FRAME) acc = 0;
      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    const onVis = () => {
      // a queued frame from before the tab hid is still pending — without
      // this the resumed loop runs alongside it and the hop rate doubles
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && sized) {
        last = 0;
        acc = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();

      if (reduced) {
        // freeze on a deliberately-chosen non-t0 frame with real structure:
        // run the ballistics forward ~3.4s past warmup so the phrase is
        // mid-swell (a legible run of lit columns) and the peak-hold marker
        // has separated from the live edge (two distinct features visible),
        // rather than freezing on the cold-start silence at t=0
        for (let i = 0; i < Math.round(3400 / HOP_MS); i++) hopRms();
        draw();
        return;
      }

      draw();
      raf = requestAnimationFrame(loop);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [source, cellSize]);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`ns-dpv w-full font-mono ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block w-full text-foreground"
        style={{ height: ROWS * cellSize }}
      />
    </div>
  );
}
