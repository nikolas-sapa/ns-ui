"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ReedVu — a voice-capture chip whose amplitude strip is driven by a real
// Web Audio AnalyserNode, never Math.random(). Four states, told apart by
// the strip's MOTION rather than color (this repo has no red/green tokens):
//   idle       — flat hairline, perfectly static. Nothing has happened yet.
//   listening  — one AnalyserNode frequency bin per bar, read every frame
//                straight off the live microphone. Chaotic because real
//                audio is chaotic.
//   processing — capture has stopped and a consumer-supplied async handler
//                is in flight; a deterministic travelling sine sweep says
//                "still working" without pretending it's audio.
//   error      — flat like idle, but the strip takes one denial-shake and a
//                legible reason renders below it, so "never started" and
//                "tried and failed" don't look identical.
// The microphone is requested only from a real click handler, never on
// mount. A denial, a missing device, or an insecure context all render the
// same honest error state rather than a control that just sits there dead.
// Every bar is a fixed-geometry pill; the ONLY thing that ever moves is a
// CSS transform: scaleY() written straight to the ref on the rAF hot path
// (transform-box: fill-box keeps the scale centred on the pill itself, not
// the SVG viewport) — no height/y attribute rewrites. React state only
// changes on discrete mode transitions.
// ---------------------------------------------------------------------------

type Mode = "idle" | "requesting" | "listening" | "processing" | "error";

const BARS = 32;
const VIEW_W = 320;
const VIEW_H = 64;
const GAP = 3;
const BAR_W = (VIEW_W - GAP * (BARS - 1)) / BARS;
// Each bar is a full-height pill, permanently sized — motion is 100% CSS
// transform: scaleY() from a fill-box centre, never a height/y attribute
// rewrite. MIN_SCALE is how thin the "flat hairline" reads at rest.
const MAX_H = VIEW_H - 10;
const MIN_SCALE = 3 / MAX_H;
const GETUM_TIMEOUT_MS = 8000;

function barX(i: number) {
  return i * (BAR_W + GAP);
}

function levelToScale(level: number) {
  return MIN_SCALE + Math.max(0, Math.min(1, level)) * (1 - MIN_SCALE);
}

function fmtClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function describeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was denied.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The microphone is already in use by another app.";
  }
  if (err instanceof Error && err.message === "timeout") {
    return "Microphone request timed out.";
  }
  return "Microphone is unavailable.";
}

function MicIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="6" y="1.5" width="4" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="6" y="1.5" width="4" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export interface ReedVuProps {
  /** what's being captured, shown above the strip — e.g. "Voice note" */
  label?: string;
  /**
   * Called once with the capture duration (ms) after the user stops
   * recording. While the returned promise is pending the strip shows the
   * processing sweep. Omit it and the chip has nothing to wait for — it
   * returns straight to idle when capture stops.
   */
  onCapture?: (durationMs: number) => Promise<void> | void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ReedVu({ label = "Voice note", onCapture, className = "" }: ReedVuProps) {
  const errId = useId();
  const [mode, setMode] = useState<Mode>("idle");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(false);

  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const timeRef = useRef<HTMLSpanElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastThrottledRef = useRef(0);
  const reducedRef = useRef(false);
  const modeRef = useRef<Mode>("idle");
  const unmountedRef = useRef(false);
  modeRef.current = mode;

  // The only thing that ever changes per bar: a transform scaleY, applied
  // directly to the DOM node on the rAF hot path (React state stays out of
  // it, same as this repo's other per-frame components).
  const setBar = (i: number, level: number) => {
    const el = barRefs.current[i];
    if (!el) return;
    el.style.transform = `scaleY(${levelToScale(level).toFixed(3)})`;
  };

  const flatten = () => {
    for (let i = 0; i < BARS; i++) setBar(i, 0);
  };

  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const releaseAudio = () => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
  };

  useEffect(() => {
    unmountedRef.current = false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reducedRef.current = mq.matches;
    };
    onMq();
    mq.addEventListener("change", onMq);
    return () => {
      unmountedRef.current = true;
      mq.removeEventListener("change", onMq);
      releaseAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listenLoop = () => {
    if (modeRef.current !== "listening") return;
    const analyser = analyserRef.current;
    const data = dataRef.current;
    const now = performance.now();
    if (analyser && data) {
      // reduced motion: still a live, honest meter, just snapshotted a few
      // times a second instead of redrawn every frame — data, not decor.
      if (!reducedRef.current || now - lastThrottledRef.current > 260) {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < BARS; i++) {
          setBar(i, data[i] / 255);
        }
        lastThrottledRef.current = now;
      }
      if (timeRef.current) {
        timeRef.current.textContent = fmtClock(Math.floor((now - startedAtRef.current) / 1000));
      }
    }
    rafRef.current = requestAnimationFrame(listenLoop);
  };

  const runProcessingSweep = (started: number) => {
    const step = (now: number) => {
      if (modeRef.current !== "processing") return;
      const t = now - started;
      for (let i = 0; i < BARS; i++) {
        const wave = 0.5 + 0.5 * Math.sin(t * 0.005 - i * 0.35);
        setBar(i, wave * 0.75);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  async function startCapture() {
    setMode("requesting");
    setMessage("Requesting microphone access…");
    flatten();

    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("error");
      setMessage("Microphone isn't available in this browser or context.");
      return;
    }

    try {
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), GETUM_TIMEOUT_MS);
        }),
      ]);
      if (unmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        stream.getTracks().forEach((t) => t.stop());
        setMode("error");
        setMessage("This browser has no Web Audio support.");
        return;
      }

      const ctx = new AudioCtor();
      await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = BARS * 2; // frequencyBinCount === BARS: one real bin per bar
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      streamRef.current = stream;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      startedAtRef.current = performance.now();
      lastThrottledRef.current = 0;

      setMode("listening");
      setMessage("Listening.");
      rafRef.current = requestAnimationFrame(listenLoop);
    } catch (err) {
      releaseAudio();
      if (unmountedRef.current) return;
      flatten();
      setMode("error");
      setMessage(describeError(err));
      if (!reducedRef.current) {
        setShake(true);
      }
    }
  }

  function stopCapture() {
    stopLoop();
    const durationMs = performance.now() - startedAtRef.current;
    releaseAudio();

    if (!onCapture) {
      flatten();
      setMode("idle");
      setMessage("");
      return;
    }

    setMode("processing");
    setMessage("Processing…");

    if (reducedRef.current) {
      // static, distinct-from-idle pattern — legible without any motion
      for (let i = 0; i < BARS; i++) setBar(i, i % 3 === 0 ? 0.55 : 0);
    } else {
      runProcessingSweep(performance.now());
    }

    Promise.resolve(onCapture(durationMs))
      .catch(() => {
        // a failed onCapture is the consumer's concern to surface, not this
        // chip's — it still returns to a clean idle strip either way.
      })
      .finally(() => {
        if (unmountedRef.current) return;
        stopLoop();
        flatten();
        setMode("idle");
        setMessage("");
      });
  }

  function handleClick() {
    if (mode === "idle" || mode === "error") startCapture();
    else if (mode === "listening") stopCapture();
  }

  const barColor = mode === "listening" || mode === "processing" ? "text-foreground" : "text-ns-muted";
  const phaseLabel: Record<Mode, string> = {
    idle: "Idle",
    requesting: "Connecting",
    listening: "Listening",
    processing: "Processing",
    error: "Error",
  };
  const buttonLabel: Record<Mode, string> = {
    idle: `Start capturing: ${label}`,
    requesting: "Connecting to microphone",
    listening: `Stop capturing: ${label}`,
    processing: "Processing capture",
    error: "Retry microphone access",
  };
  const disabled = mode === "requesting" || mode === "processing";

  return (
    <div className={["w-full rounded-md border border-border bg-surface p-4", className].join(" ")}>
      <style>{`
@keyframes ns-reed-shake{
  10%,90%{transform:translateX(-1px)}
  20%,80%{transform:translateX(2px)}
  30%,50%,70%{transform:translateX(-3px)}
  40%,60%{transform:translateX(3px)}
}
.ns-reed-shake{animation:ns-reed-shake 420ms cubic-bezier(0.36,0.07,0.19,0.97) both}
@media (prefers-reduced-motion: reduce){
  .ns-reed-shake{animation:none}
}
`}</style>

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ns-muted">{label}</span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ns-muted">
          {phaseLabel[mode]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={buttonLabel[mode]}
          aria-pressed={mode === "listening"}
          aria-describedby={mode === "error" ? errId : undefined}
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
            mode === "listening" ? "border-ns-accent text-ns-accent" : "border-border text-ns-muted hover:border-ns-muted hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:cursor-not-allowed disabled:opacity-60",
          ].join(" ")}
        >
          {mode === "error" ? <MicOffIcon /> : mode === "listening" ? <StopIcon /> : <MicIcon />}
        </button>

        <div
          className={["min-w-0 flex-1", shake ? "ns-reed-shake" : ""].join(" ")}
          onAnimationEnd={() => setShake(false)}
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className={["h-10 w-full", barColor].join(" ")}
            data-reed-strip
            aria-hidden
          >
            {Array.from({ length: BARS }).map((_, i) => (
              <rect
                key={i}
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                x={barX(i)}
                y={(VIEW_H - MAX_H) / 2}
                width={BAR_W}
                height={MAX_H}
                rx={BAR_W / 2}
                fill="currentColor"
                style={{ transformBox: "fill-box", transformOrigin: "50% 50%", transform: `scaleY(${MIN_SCALE})` }}
              />
            ))}
          </svg>
        </div>

        {mode === "listening" ? (
          <span ref={timeRef} className="shrink-0 font-mono text-[11px] tabular-nums text-ns-muted">
            00:00
          </span>
        ) : null}
      </div>

      {mode === "error" ? (
        <p id={errId} className="mt-3 text-xs text-foreground">
          {message}
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {mode === "idle" ? "" : message}
      </p>
    </div>
  );
}
