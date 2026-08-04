"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// SpectrogramAsciiBands — a scrolling spectrogram printed in monospace ink.
//
// The analysis is real: a 512-point radix-2 Cooley–Tukey FFT (inlined, no
// dependency) over a Hann-windowed frame, magnitudes in dB, grouped into 32
// log-spaced bands. The mechanism that makes it READABLE rather than a
// uniform medium-density wash is the per-band adaptive floor: each band runs
// its own slow AGC that falls fast (0.02) and rises slowly (0.002) toward the
// band's own dB, so it tracks the QUIET baseline. A steady hiss sinks into
// its own floor and disappears; only structure that stands above its band's
// baseline prints at all, and anything under floor + 12 dB prints nothing. Most
// of the frame is empty by construction.
//
// The pointer never distorts the field — the cells are measurements, and
// bending them would lie. It parks a cursor on a column and reads that
// column's peak out in the readout instead.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;

const FFT_N = 512;
const LOG2N = 9;
const BANDS = 32;
const MIN_BIN = 2;
const MAX_BIN = 200;
const HOP_MS = 50;
const SEED_COLS = 240;

const FLOOR_INIT = -70; // dB — seeded low so the AGC warms UP into each band's baseline
const FLOOR_MAX = -35; // dB — the AGC stays in the quiet regime; it may not climb onto the subject
const WARMUP_HOPS = 300; // analysis-only hops before any visible column is committed
const WARMUP_BOOST = 12; // rise coefficient multiplier during warmup only
const FLOOR_FALL = 0.02;
const FLOOR_RISE = 0.002;
const GATE_DB = 12; // dB above floor before a cell prints anything at all
const SPAN_DB = 32; // dB above floor mapped across the full ramp

const CURSOR_TAU = 0.4; // s — cursor / readout crossfade time constant
const DT_MAX = 0.25;
const MAX_HOPS_PER_FRAME = 4;

const SYNTH_SR = 16000;
const LABEL_BANDS = [0, 8, 16, 24, 31];

// -- FFT tables -------------------------------------------------------------
const REV = new Uint16Array(FFT_N);
for (let i = 0; i < FFT_N; i++) {
  let r = 0;
  for (let b = 0; b < LOG2N; b++) r |= ((i >> b) & 1) << (LOG2N - 1 - b);
  REV[i] = r;
}
const TW_COS = new Float32Array(FFT_N / 2);
const TW_SIN = new Float32Array(FFT_N / 2);
for (let i = 0; i < FFT_N / 2; i++) {
  TW_COS[i] = Math.cos((-2 * Math.PI * i) / FFT_N);
  TW_SIN[i] = Math.sin((-2 * Math.PI * i) / FFT_N);
}
const HANN = new Float32Array(FFT_N);
for (let n = 0; n < FFT_N; n++) {
  HANN[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (FFT_N - 1));
}

// Band k covers bins BAND_START[k] .. BAND_START[k+1]. The ratio 100^(1/32) is
// under 1.16, so the log formula's first ten starts collide on bins 2..5 — left
// as-is that prints ten byte-identical rows at the bottom of the field and a
// max() over an empty range yields -Infinity. Each start is therefore forced
// strictly above its predecessor, which makes the lowest bands one bin wide
// (the FFT's own resolution limit down there) and log-spaced from there up.
const BAND_START = new Int32Array(BANDS + 1);
{
  let prev = -1;
  for (let k = 0; k <= BANDS; k++) {
    let v = Math.floor(MIN_BIN * Math.pow(MAX_BIN / MIN_BIN, k / BANDS));
    if (v <= prev) v = prev + 1;
    BAND_START[k] = v;
    prev = v;
  }
}

function fft(re: Float32Array, im: Float32Array) {
  for (let i = 0; i < FFT_N; i++) {
    const j = REV[i]!;
    if (j > i) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let size = 2; size <= FFT_N; size <<= 1) {
    const half = size >> 1;
    const step = FFT_N / size;
    for (let i = 0; i < FFT_N; i += size) {
      for (let j = 0; j < half; j++) {
        const k = j * step;
        const wr = TW_COS[k]!;
        const wi = TW_SIN[k]!;
        const a = i + j;
        const b = a + half;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
}

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
 * Deterministic stand-in for a microphone: two vowel-like formants at 320 Hz
 * and 1.9 kHz with a shared ±8% vibrato at 0.4 Hz, an exponential 200→4000 Hz
 * sweep looping every 9 s, and pink-ish noise at −48 dB. Nothing here calls
 * getUserMedia, so the preview never meets a permission prompt.
 */
function createSyntheticSource() {
  const rand = mulberry32(0x5c09a1);
  let t = 0;
  let p1 = 0;
  let p2 = 0;
  let ps = 0;
  let pink = 0;
  const dt = 1 / SYNTH_SR;
  return (n: number, write: (v: number) => void) => {
    for (let i = 0; i < n; i++) {
      t += dt;
      const vib = 1 + 0.08 * Math.sin(2 * Math.PI * 0.4 * t);
      const fs = 200 * Math.pow(20, (t % 9) / 9);
      p1 += 2 * Math.PI * 320 * vib * dt;
      p2 += 2 * Math.PI * 1900 * vib * dt;
      ps += 2 * Math.PI * fs * dt;
      pink = pink * 0.96 + (rand() * 2 - 1) * 0.04;
      write(
        0.5 * Math.sin(p1) +
          0.32 * Math.sin(p2) +
          0.3 * Math.sin(ps) +
          pink * 0.012
      );
    }
  };
}

export interface SpectrogramAsciiBandsProps {
  /**
   * Where samples come from: a live `AnalyserNode`, or a provider that fills
   * the passed Float32Array with the newest 512 time-domain samples. Omitted
   * ⇒ the built-in deterministic synthetic signal.
   */
  source?: AnalyserNode | ((out: Float32Array) => void);
  /** Row height in px; the field is (32 + 2) rows tall. Default 16. */
  cellSize?: number;
  /** Accessible name for the focusable readout region. */
  label?: string;
  className?: string;
}

export function SpectrogramAsciiBands({
  source,
  cellSize = 16,
  label = "Spectrogram readout — arrow keys step the cursor through the history",
  className = "",
}: SpectrogramAsciiBandsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const cursorTextRef = useRef<HTMLSpanElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const srRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sampleRate =
      source instanceof AnalyserNode ? source.context.sampleRate : SYNTH_SR;
    const hopSamples = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));
    const binHz = sampleRate / FFT_N;

    const fmtHz = (hz: number) =>
      hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;

    // gutter labels depend on the source's sample rate, so they are written
    // here rather than baked into the markup
    const gutter = gutterRef.current;
    if (gutter) {
      for (const el of Array.from(gutter.children)) {
        const b = Number((el as HTMLElement).dataset.band);
        (el as HTMLElement).textContent = fmtHz(BAND_START[b]! * binHz);
      }
    }

    // -- analysis state ------------------------------------------------------
    const ring = new Float32Array(FFT_N); // newest 512 samples, modular
    let ringHead = 0;
    const re = new Float32Array(FFT_N);
    const im = new Float32Array(FFT_N);
    const floors = new Float32Array(BANDS).fill(FLOOR_INIT);
    const bandDb = new Float32Array(BANDS);
    const synth = createSyntheticSource();
    const writeSample = (v: number) => {
      ring[ringHead] = v;
      ringHead = (ringHead + 1) % FFT_N;
    };
    const external =
      source instanceof AnalyserNode
        ? (() => {
            const buf = new Float32Array(source.fftSize);
            return () => {
              source.getFloatTimeDomainData(buf);
              const off = Math.max(0, buf.length - FFT_N);
              for (let i = 0; i < FFT_N; i++) writeSample(buf[off + i] ?? 0);
            };
          })()
        : typeof source === "function"
          ? (() => {
              const buf = new Float32Array(FFT_N);
              return () => {
                source(buf);
                for (let i = 0; i < FFT_N; i++) writeSample(buf[i] ?? 0);
              };
            })()
          : null;

    // -- history ring --------------------------------------------------------
    let cols = 0;
    let cells = new Uint8Array(0); // ramp index per (col, band)
    let peakBand = new Uint8Array(0);
    let peakDb = new Float32Array(0);
    let head = 0; // oldest column

    let riseBoost = 1;

    const analyse = () => {
      if (external) external();
      else synth(hopSamples, writeSample);

      for (let n = 0; n < FFT_N; n++) {
        re[n] = ring[(ringHead + n) % FFT_N]! * HANN[n]!;
        im[n] = 0;
      }
      fft(re, im);

      for (let k = 0; k < BANDS; k++) {
        const start = BAND_START[k]!;
        const end = Math.max(start + 1, BAND_START[k + 1]!);
        let best = -Infinity;
        for (let b = start; b < end; b++) {
          const mag = Math.sqrt(re[b]! * re[b]! + im[b]! * im[b]!) / (FFT_N / 4);
          const db = 20 * Math.log10(mag + 1e-9);
          if (db > best) best = db;
        }
        bandDb[k] = best;
        const f = floors[k]!;
        floors[k] = Math.min(
          FLOOR_MAX,
          f + (best - f) * (best < f ? FLOOR_FALL : FLOOR_RISE * riseBoost)
        );
      }
    };

    const commitColumn = () => {
      if (cols === 0) return;
      const col = head;
      head = (head + 1) % cols;
      const base = col * BANDS;
      let bestBand = 0;
      let bestExcess = -Infinity;
      for (let k = 0; k < BANDS; k++) {
        const excess = bandDb[k]! - floors[k]!;
        let idx = 0;
        if (excess >= GATE_DB) {
          idx = Math.round((excess / SPAN_DB) * 9);
          idx = idx < 1 ? 1 : idx > 9 ? 9 : idx;
        }
        cells[base + k] = idx;
        if (excess > bestExcess) {
          bestExcess = excess;
          bestBand = k;
        }
      }
      peakBand[col] = bestExcess >= GATE_DB ? bestBand : 255;
      peakDb[col] = bandDb[bestBand]!;
    };

    const hop = () => {
      analyse();
      commitColumn();
    };

    // -- layout / tokens -----------------------------------------------------
    let fg = "currentColor";
    let accent = "currentColor";
    let cellW = cellSize * 0.6;
    const cellH = cellSize;
    const rows = BANDS + 1; // row 0 = headroom, rows 1..32 = field (band 31 at top)
    let sized = false;
    let disposed = false;
    let warmed = false;

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
      accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim() || fg;
    };

    const bucketLists: number[][] = Array.from({ length: ALPHA_BUCKETS }, () => []);

    const resize = () => {
      const { width } = canvas.getBoundingClientRect();
      const height = rows * cellH;
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
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const nextCols = Math.max(16, Math.floor(width / cellW));
      if (nextCols !== cols) {
        cols = nextCols;
        cells = new Uint8Array(cols * BANDS);
        peakBand = new Uint8Array(cols).fill(255);
        peakDb = new Float32Array(cols);
        head = 0;
        if (!warmed) {
          // Settle the per-band floors BEFORE any visible column is committed,
          // with a boosted rise coefficient so ~300 hops reach where the real
          // 0.002 coefficient would need ~2000. Without it every band's floor
          // is still down at its -70 dB seed, everything clears the gate, and
          // the first visible field is a uniform medium-density wash.
          riseBoost = WARMUP_BOOST;
          for (let i = 0; i < WARMUP_HOPS; i++) analyse();
          riseBoost = 1;
          warmed = true;
        }
        for (let i = 0; i < Math.max(cols, SEED_COLS); i++) hop();
      }
      sized = true;
    };

    // -- cursor state (refs only; nothing on the hot path is React state) -----
    let cursorCol: number | null = null; // screen column, 0 = oldest/left
    let cursorAlpha = 0;

    const setReadout = () => {
      const live = liveRef.current;
      const cur = cursorTextRef.current;
      if (live) {
        // running summary: the loudest band across the whole visible window
        let bb = 255;
        let bd = -Infinity;
        for (let j = 0; j < cols; j++) {
          const c = (head + j) % cols;
          if (peakBand[c] === 255) continue;
          if (peakDb[c]! > bd) {
            bd = peakDb[c]!;
            bb = peakBand[c]!;
          }
        }
        live.textContent =
          bb === 255
            ? `no signal above floor · ${((cols * HOP_MS) / 1000).toFixed(1)} s window`
            : `peak ${fmtHz(BAND_START[bb]! * binHz)}  ${bd >= 0 ? "" : "−"}${Math.abs(bd).toFixed(0)} dB  · ${((cols * HOP_MS) / 1000).toFixed(1)} s window`;
      }
      if (cur) {
        if (cursorCol === null) cur.textContent = "";
        else {
          const c = (head + cursorCol) % cols;
          const age = ((cols - 1 - cursorCol) * HOP_MS) / 1000;
          const b = peakBand[c];
          cur.textContent =
            b === undefined || b === 255
              ? `— below floor  ${age.toFixed(1)} s ago`
              : `${fmtHz(BAND_START[b]! * binHz)}  ${peakDb[c]! >= 0 ? "" : "−"}${Math.abs(peakDb[c]!).toFixed(0)} dB  ${age.toFixed(1)} s ago`;
        }
      }
    };

    const draw = () => {
      if (!sized) return;
      const w = cols * cellW;
      ctx.clearRect(0, 0, w + cellW, rows * cellH);

      // field — pass one buckets, pass two draws one alpha per bucket
      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;
      for (let j = 0; j < cols; j++) {
        const c = (head + j) % cols;
        const base = c * BANDS;
        for (let k = 0; k < BANDS; k++) {
          const idx = cells[base + k]!;
          if (idx === 0) continue;
          const bucket = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(((idx - 1) / 9) * ALPHA_BUCKETS)
          );
          bucketLists[bucket]!.push((j << 8) | (k << 2) | 0);
        }
      }
      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        ctx.globalAlpha = 0.22 + (b / (ALPHA_BUCKETS - 1)) * 0.78;
        for (let n = 0; n < list.length; n++) {
          const packed = list[n]!;
          const j = packed >> 8;
          const k = (packed >> 2) & 63;
          const c = (head + j) % cols;
          ctx.fillText(
            RAMP[cells[c * BANDS + k]!]!,
            j * cellW + cellW / 2,
            (1 + (BANDS - 1 - k)) * cellH + cellH * 0.5
          );
        }
      }

      // pitch track — the argmax band of each column, one accent dot drawn ON
      // its own row (a one-row strip cannot encode WHICH band won, so it
      // degenerates into a solid rule). Drawn after the field so it reads as a
      // contour riding over the dominant ribbon.
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.9;
      for (let j = 0; j < cols; j++) {
        const c = (head + j) % cols;
        const b = peakBand[c];
        if (b === undefined || b === 255) continue;
        ctx.fillText(
          "·",
          j * cellW + cellW / 2,
          (1 + (BANDS - 1 - b)) * cellH + cellH * 0.5
        );
      }

      // cursor — a measurement marker, never a distortion of the field
      if (cursorCol !== null && cursorAlpha > 0.01) {
        ctx.fillStyle = accent;
        ctx.globalAlpha = cursorAlpha * 0.8;
        const x = cursorCol * cellW + cellW / 2;
        for (let r = 1; r < rows; r++) ctx.fillText("┊", x, r * cellH + cellH * 0.5);
      }
      ctx.globalAlpha = 1;
    };

    const applyFade = () => {
      const cur = cursorTextRef.current;
      const live = liveRef.current;
      if (cur) cur.style.opacity = String(cursorAlpha);
      if (live) live.style.opacity = String(1 - cursorAlpha);
    };

    // -- loop ----------------------------------------------------------------
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
        hop();
        hops++;
      }
      if (acc > HOP_MS * MAX_HOPS_PER_FRAME) acc = 0;
      const target = cursorCol !== null ? 1 : 0;
      cursorAlpha += (target - cursorAlpha) * Math.min(1, dt / CURSOR_TAU);
      if (cursorCol === null && cursorAlpha < 0.01) cursorAlpha = 0;
      if (hops > 0 || cursorAlpha > 0) setReadout();
      applyFade();
      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const colFromClientX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const j = Math.floor((clientX - rect.left) / cellW);
      return j < 0 ? 0 : j > cols - 1 ? cols - 1 : j;
    };
    const onPointerMove = (e: PointerEvent) => {
      cursorCol = colFromClientX(e.clientX);
    };
    const onPointerLeave = () => {
      cursorCol = null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      const from = cursorCol === null ? cols - 1 : cursorCol + step;
      cursorCol = from < 0 ? 0 : from > cols - 1 ? cols - 1 : from;
      setReadout();
      // announce only on a deliberate key step — the 20 Hz running summary is
      // never put in the live region, which would be a screen-reader firehose
      const sr = srRef.current;
      if (sr) sr.textContent = cursorTextRef.current?.textContent ?? "";
      if (reduced) {
        cursorAlpha = 1;
        setReadout();
        applyFade();
        draw();
      }
    };
    const onBlur = () => {
      if (cursorCol !== null && document.activeElement !== readoutRef.current) {
        cursorCol = null;
        const sr = srRef.current;
        if (sr) sr.textContent = "";
        if (reduced) {
          cursorAlpha = 0;
          setReadout();
          applyFade();
          draw();
        }
      }
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
        setReadout();
        if (reduced) draw();
      }, 150);
    };

    const onVis = () => {
      // the frame queued before the tab hid is still pending — without this the
      // resumed loop runs alongside it and the hop rate silently doubles
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && sized) {
        last = 0;
        acc = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const readout = readoutRef.current;
    readout?.addEventListener("keydown", onKeyDown);
    readout?.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    if (!reduced) {
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
    }

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      setReadout();
      applyFade();
      draw();
      if (!reduced) raf = requestAnimationFrame(loop);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      readout?.removeEventListener("keydown", onKeyDown);
      readout?.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [source, cellSize]);

  const fieldHeight = (BANDS + 1) * cellSize;

  return (
    <div className={`ns-sab w-full font-mono ${className}`}>
      <style>{CSS}</style>
      <div className="flex w-full items-start">
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="relative shrink-0"
          style={{ width: cellSize * 4.2, height: fieldHeight }}
        >
          {LABEL_BANDS.map((b) => (
            <span
              key={b}
              data-band={b}
              className="absolute right-0 flex items-center justify-end pr-2 text-muted"
              style={{
                top: (1 + (BANDS - 1 - b)) * cellSize,
                height: cellSize,
                fontSize: Math.max(9, cellSize * 0.62),
                lineHeight: 1,
              }}
            />
          ))}
        </div>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block min-w-0 flex-1 text-foreground"
          style={{ height: fieldHeight }}
        />
      </div>
      <div
        ref={readoutRef}
        tabIndex={0}
        role="group"
        aria-label={label}
        className="ns-sab-readout relative mt-2 block w-full rounded-sm border border-border px-3 outline-none"
        style={{ height: cellSize * 1.9, fontSize: Math.max(10, cellSize * 0.68) }}
      >
        <span
          ref={liveRef}
          className="absolute inset-0 flex items-center px-3 text-muted"
        />
        <span
          ref={cursorTextRef}
          className="absolute inset-0 flex items-center px-3 text-foreground"
          style={{ opacity: 0 }}
        />
        <span ref={srRef} aria-live="polite" className="ns-sab-sr" />
      </div>
    </div>
  );
}

const CSS = `
.ns-sab-readout:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
.ns-sab-readout:hover { border-color: var(--accent); }
.ns-sab-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
