"use client";

import { useEffect, useState } from "react";
import { LoupeSlider } from "./component";

const DURATION = 262; // 4:22

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function IconSkipBack() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  );
}

function IconSkipForward() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="7 4 20 12 7 20 7 4" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

const buttonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-transparent text-foreground transition-colors hover:border-foreground/30 hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export default function LoupeSliderDemo() {
  const [pos, setPos] = useState(74);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(175);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos((p) => Math.min(DURATION, p + 1)), 1000);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (playing && pos >= DURATION) setPlaying(false);
  }, [playing, pos]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / slider-loupe — the lens is the readout
      </p>

      <div className="w-full max-w-xl rounded-md border border-border bg-surface">
        {/* now playing */}
        <div className="flex items-center gap-4 border-b border-border px-6 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-border bg-foreground/[0.04] text-muted">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="4" y1="10" x2="4" y2="14" />
              <line x1="8" y1="7" x2="8" y2="17" />
              <line x1="12" y1="4" x2="12" y2="20" />
              <line x1="16" y1="8" x2="16" y2="16" />
              <line x1="20" y1="11" x2="20" y2="13" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              Nocturne in Monochrome
            </h2>
            <p className="truncate text-sm text-muted">
              Signal Terrain — Field Recordings, Vol. II
            </p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            {playing ? "playing" : "paused"}
          </span>
        </div>

        {/* scrub */}
        <div className="px-6 pb-2 pt-5">
          <div className="flex items-baseline justify-between font-mono text-xs">
            <span className="tabular-nums text-foreground">{fmtTime(pos)}</span>
            <span className="tabular-nums text-muted">{fmtTime(DURATION)}</span>
          </div>
          <LoupeSlider
            value={pos}
            onValueChange={setPos}
            min={0}
            max={DURATION}
            step={1}
            tickStep={10}
            majorEvery={3}
            formatLabel={fmtTime}
            formatValue={(v) => `${fmtTime(v)} of ${fmtTime(DURATION)}`}
            aria-label="Playback position"
            className="mt-1"
          />
        </div>

        {/* transport */}
        <div className="flex items-center justify-center gap-3 px-6 pb-6">
          <button
            type="button"
            aria-label="Back 15 seconds"
            className={buttonClass}
            onClick={() => setPos((p) => Math.max(0, p - 15))}
          >
            <IconSkipBack />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-foreground text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            aria-label="Forward 15 seconds"
            className={buttonClass}
            onClick={() => setPos((p) => Math.min(DURATION, p + 15))}
          >
            <IconSkipForward />
          </button>
        </div>

        {/* zoom */}
        <div className="border-t border-border px-6 py-5">
          <div className="flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Waveform zoom
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Magnification of the editor timeline.
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-foreground">
              {zoom}%
            </span>
          </div>
          <LoupeSlider
            value={zoom}
            onValueChange={setZoom}
            min={50}
            max={400}
            step={25}
            tickStep={25}
            majorEvery={2}
            formatLabel={(v) => `${v}%`}
            aria-label="Waveform zoom level"
            className="mt-2"
          />
        </div>

        <div className="border-t border-border px-6 py-3">
          <p className="font-mono text-[11px] text-muted">
            drag past either end for a rubber-band wobble · arrows / PageUp /
            Home steer the lens
          </p>
        </div>
      </div>
    </div>
  );
}
