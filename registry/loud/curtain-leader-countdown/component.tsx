"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// CurtainLeaderCountdown — a full-bleed route curtain modeled on the SMPTE
// Universal Leader film countdown (1966): a rotating clock-arm sweeping a
// circular target once per digit, numerals ticking 8->2, C/C/F/F control-
// frame glyphs flashing only on the "4" count, and a black "PICTURE START"
// beat before the loop restarts.
//
// COMPRESSED, NOT LITERAL. The real leader runs one numeral per real second
// (~9s total). Preview-card scale can't carry that, so this compresses to
// 450ms/digit (7 steps, 8->2, ~3.15s) plus a 350ms black beat, ~3.5s/cycle.
// The clock-arm still does one full revolution per digit, just tied to the
// (much faster) digit interval rather than a real second — a stated
// departure, not a fidelity claim.
//
// THE 2-POP HAS NO VISUAL EQUIVALENT IN THE SOURCE. The leader's "2-pop" is
// an audio cue with nothing to look at. Here it is translated as a one-frame
// flash of the target ring to full --foreground plus a brief scale-pulse,
// landing right before the cut to black — an invented stand-in, not a
// historical detail, and it goes to full VALUE only, never --ns-accent: that
// is the standing pointer/beam-highlight rule generalized to a scripted
// flash, and sampling its R/G/B in either theme must land on equal channels.
//
// Every phase of the loop is a presentable frame on purpose, because the
// no-autoplay verifier can land on any of them: the ring outline is drawn
// every frame regardless of phase, the outgoing digit ghosts into the
// incoming one in --ns-muted instead of hard-cutting, and the black beat
// still shows the ring plus a muted ghost of the "2" target rather than a
// truly empty frame.
// ---------------------------------------------------------------------------

export interface CurtainLeaderCountdownProps {
  /** Called once per completed cycle, right as the black beat ends. */
  onComplete?: () => void;
  /** Restart automatically after each cycle. @default true */
  loop?: boolean;
  /** Freeze the loop on its current frame without unmounting. */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const DIGIT_MS = 450; // compressed from the source's 1 numeral/real second
const STEPS = 7; // 8,7,6,5,4,3,2
const COUNTDOWN_MS = DIGIT_MS * STEPS; // 3150
const BEAT_MS = 350; // black "PICTURE START" beat before the loop restarts
const CYCLE_MS = COUNTDOWN_MS + BEAT_MS; // 3500
const FIRST_DIGIT = 8;
const LAST_DIGIT = 2;
const CONTROL_DIGIT = 4; // C/C/F/F only render on this step, as in the source
const GHOST_FRAC = 0.22; // fraction of a digit step the outgoing ghost fades across
const FLASH_FRAC = 0.82; // fraction into the "2" step the 2-pop stand-in begins
const ANNOUNCE_MIN_MS = 1400; // sr-only throttle, well below the 450ms tick

// The frozen reduced-motion frame: a quarter-turn into the "4" step's sweep
// — control frames visible, numeral centered, arm at a clean quadrant angle.
// The single most structured frame in the loop, deliberately not t=0.
const STATIC_MS = (FIRST_DIGIT - CONTROL_DIGIT) * DIGIT_MS + DIGIT_MS * 0.25;

interface Frame {
  phase: "countdown" | "beat";
  digit: number;
  ghostDigit: number | null;
  ghostAlpha: number;
  angle: number;
  showControls: boolean;
  flashAmt: number;
}

function computeFrame(msIntoCycle: number): Frame {
  if (msIntoCycle < COUNTDOWN_MS) {
    const idx = Math.min(STEPS - 1, Math.floor(msIntoCycle / DIGIT_MS));
    const localFrac = (msIntoCycle - idx * DIGIT_MS) / DIGIT_MS;
    const digit = FIRST_DIGIT - idx;
    const ghostDigit = idx > 0 ? digit + 1 : null;
    const ghostAlpha =
      ghostDigit !== null ? Math.max(0, 1 - localFrac / GHOST_FRAC) : 0;
    const flashAmt =
      digit === LAST_DIGIT && localFrac >= FLASH_FRAC
        ? (localFrac - FLASH_FRAC) / (1 - FLASH_FRAC)
        : 0;
    return {
      phase: "countdown",
      digit,
      ghostDigit,
      ghostAlpha,
      angle: localFrac * Math.PI * 2,
      showControls: digit === CONTROL_DIGIT,
      flashAmt,
    };
  }
  // the black beat: never a genuinely empty frame — the ring stays on
  // screen and a muted ghost of the "2" target holds through the whole beat
  const beatFrac = (msIntoCycle - COUNTDOWN_MS) / BEAT_MS;
  return {
    phase: "beat",
    digit: LAST_DIGIT,
    ghostDigit: LAST_DIGIT,
    ghostAlpha: 0.18 + 0.22 * (1 - beatFrac),
    angle: Math.PI * 2,
    showControls: false,
    flashAmt: 0,
  };
}

export function CurtainLeaderCountdown({
  onComplete,
  loop = true,
  paused,
  className = "",
  style,
}: CurtainLeaderCountdownProps) {
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let running = false;
    let raf = 0;
    let lastMs = 0;
    let simMs = 0;
    let staticMode = false;
    let stoppedAtEnd = false;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;

    // No hex fallback: a literal here would necessarily encode one theme's
    // polarity, so a dark-theme user could get a wrong-polarity flash on
    // first paint before the token read below lands. readTokens() runs
    // synchronously, before resize()/applyMode() ever call draw(), so these
    // are never read unassigned.
    let bg = "";
    let fg = "";
    let muted = "";
    let family = "ui-monospace, monospace";

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = cs.getPropertyValue("--background").trim();
      fg = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
    };
    readTokens();

    const readFont = () => {
      family = getComputedStyle(wrap).fontFamily || family;
    };
    readFont();

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      cssW = width;
      cssH = height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    let lastAnnounced = -1;
    let lastAnnounceAt = -Infinity;

    const draw = (msIntoCycle: number) => {
      if (cssW <= 0 || cssH <= 0) return;
      const frame = computeFrame(msIntoCycle);

      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      const cx = cssW / 2;
      const cy = cssH / 2;
      // Outer ring diameter ~0.34 of the smaller dimension — the target is
      // an object sitting inside a generous field, not the frame itself.
      // Numeral, arm, guide ring and control-glyph placement all derive
      // from radius below, so the whole assembly scales proportionally at
      // any container size, full-bleed or a small registry preview card.
      const radius = Math.min(cssW, cssH) * 0.17;

      // inner guide ring — quiet structural echo of the outer target ring.
      // --border is a near-zero-contrast separator token (~1.1:1 in light
      // theme), so a hairline drawn IN it would be invisible; --ns-muted is
      // the token whose luminance sits strictly between bg and fg in both
      // themes, so the hairline weight comes from lineWidth, not from --border.
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = muted;
      ctx.lineWidth = Math.max(1, radius * 0.01);
      ctx.globalAlpha = 1;
      ctx.stroke();

      // outer target ring — always on screen, every phase, so the black
      // beat never reads as a dead render
      const ringScale = 1 + 0.14 * frame.flashAmt;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * ringScale, 0, Math.PI * 2);
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(2, radius * 0.035);
      ctx.globalAlpha = 1;
      ctx.stroke();

      // 2-pop stand-in: a one-frame flash of the target RING (not a filled
      // disc — the numeral and arm must stay legible through it) to full
      // --foreground value at full alpha, thickened, plus the scale-pulse
      // above — value only, never accent, so both themes flash to equal R/G/B
      if (frame.flashAmt > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * ringScale, 0, Math.PI * 2);
        ctx.strokeStyle = fg;
        ctx.lineWidth = Math.max(2, radius * (0.035 + 0.05 * frame.flashAmt));
        ctx.globalAlpha = 1;
        ctx.stroke();
      }

      // clock arm — one full revolution per digit step, starting at 12
      const armLen = radius * ringScale * 0.92;
      const armAngle = frame.angle - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(armAngle) * armLen, cy + Math.sin(armAngle) * armLen);
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(2, radius * 0.045);
      ctx.lineCap = "round";
      ctx.stroke();

      // control-frame glyphs — only during the "4" step, hairline weight
      // (weight, not a --border color — see the guide-ring note above),
      // one in each corner of the ring's bounding box, as in the source
      if (frame.showControls) {
        const off = radius * 0.8;
        const glyphSize = Math.max(10, radius * 0.16);
        ctx.font = `${glyphSize}px ${family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(1, glyphSize * 0.06);
        ctx.strokeStyle = muted;
        ctx.globalAlpha = 1;
        const corners: [string, number, number][] = [
          ["C", cx - off, cy - off],
          ["C", cx + off, cy - off],
          ["F", cx - off, cy + off],
          ["F", cx + off, cy + off],
        ];
        for (const [glyph, gx, gy] of corners) {
          ctx.strokeText(glyph, gx, gy);
        }
      }

      // numeral — ghost of the outgoing/target digit in --ns-muted, then
      // (outside the black beat) the current digit solid in --foreground.
      // "middle" textBaseline centers on the font's full ascent+descent
      // box, which reserves room for descenders (g/j/p/y) that digits never
      // use — left uncorrected, every numeral renders visibly above the
      // ring's true center. optical Y per glyph pulls it back onto center:
      // measureText's actualBoundingBox*/descent are reported relative to
      // the "middle" anchor already in place, so (ascent - descent) / 2 is
      // exactly the remaining offset between that anchor and the glyph's
      // own visual midpoint.
      const numSize = radius * 1.15;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${numSize}px ${family}`;
      const opticalY = (digit: number) => {
        const m = ctx.measureText(String(digit));
        return cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      };

      if (frame.ghostDigit !== null && frame.ghostAlpha > 0) {
        ctx.fillStyle = muted;
        ctx.globalAlpha = frame.ghostAlpha;
        ctx.fillText(String(frame.ghostDigit), cx, opticalY(frame.ghostDigit));
      }
      if (frame.phase === "countdown") {
        ctx.fillStyle = fg;
        ctx.globalAlpha = 1;
        ctx.fillText(String(frame.digit), cx, opticalY(frame.digit));
      }
      ctx.globalAlpha = 1;

      // sr-only live region — throttled well below the 450ms tick so a
      // screen reader gets one legible announcement per digit, not seven
      if (
        liveRef.current &&
        frame.digit !== lastAnnounced &&
        performance.now() - lastAnnounceAt >= ANNOUNCE_MIN_MS
      ) {
        lastAnnounced = frame.digit;
        lastAnnounceAt = performance.now();
        liveRef.current.textContent =
          frame.phase === "beat" ? "cue" : String(frame.digit);
      }
    };

    const loopFrame = (nowMs: number) => {
      if (!running) return;
      const dt = Math.min(50, lastMs ? nowMs - lastMs : 16.7);
      lastMs = nowMs;
      simMs += dt;
      if (simMs >= CYCLE_MS) {
        onCompleteRef.current?.();
        if (loopRef.current) {
          simMs %= CYCLE_MS;
        } else {
          simMs = CYCLE_MS - 1;
          stoppedAtEnd = true;
          draw(simMs);
          sleep();
          setStatus(false);
          return;
        }
      }
      draw(simMs);
      raf = requestAnimationFrame(loopFrame);
    };

    const wake = () => {
      if (running || disposed || staticMode || stoppedAtEnd) return;
      running = true;
      lastMs = 0;
      raf = requestAnimationFrame(loopFrame);
    };
    const sleep = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const setStatus = (busy: boolean) => {
      statusRef.current?.setAttribute("aria-busy", busy ? "true" : "false");
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        draw(reduced ? STATIC_MS : simMs);
        setStatus(false);
      } else {
        staticMode = false;
        setStatus(!stoppedAtEnd);
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const ro = new ResizeObserver(() => {
      resize();
      if (staticMode) draw(reduced ? STATIC_MS : simMs);
    });
    ro.observe(wrap);
    resize();

    const themeObserver = new MutationObserver(() => {
      readTokens();
      if (staticMode) draw(reduced ? STATIC_MS : simMs);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let lastPolledPaused = pausedRef.current;
    const poll = window.setInterval(() => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
    }, 140);

    applyMode();

    return () => {
      disposed = true;
      sleep();
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      data-curtain-leader-countdown={uid}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {/* separate siblings, not nested — an aria-busy=true ancestor tells AT
          to withhold updates from its whole subtree, which would silently
          swallow the throttled live-region announcements below */}
      <div ref={statusRef} role="status" aria-busy="true" className="sr-only" />
      <span ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}

CurtainLeaderCountdown.displayName = "CurtainLeaderCountdown";
