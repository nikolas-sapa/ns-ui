"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// WarpKnitTricotLapping — an ambient warp-knit (tricot) guide-bar lapping
// texture. Unlike weft knitting, every needle has its own yarn fed from a
// guide bar that holds ALL yarns in a row; between courses the whole bar
// SHOGS (shifts) a short lateral distance before swinging back to the
// needles, so each thread laps diagonally across neighbouring needles
// course after course rather than staying in one column. That diagonal
// shog-and-lap is what gives tricot its run-resistant diagonal wale
// structure (unlike weft knit, no single dropped loop can ladder the whole
// column) — the direct opposite motion of a weft-insertion shuttle pass
// (loader-loom-weave), which crosses the FULL width of a fixed warp.
//
// Every needle in a row shares the SAME guide-bar offset, so drawing one
// diagonal segment per needle per course — from its previous shogged
// position to its new one — produces a field of parallel diagonal lines
// that reverse direction in lockstep every course: the classic tricot
// herringbone/chevron. A basic "2 and 2" lapping chain: the bar shogs 2
// needle-spaces right, then 2 needle-spaces left, alternating every course,
// so the offset itself is a triangle wave (0, +2, 0, +2, ...) rather than
// an unbounded drift.
//
// One course completes every 500ms: first a 200ms eased lateral slide of
// the whole guide row (a bright tick per needle, "where the work is
// happening"), then the lap segments for that course commit in a single
// instant redraw — never a gradually-growing line. A separate, decoupled
// clock scrolls the accumulated field upward at one course-height per
// 500ms, so completed courses feed off the top edge while the guide bar
// itself stays anchored at a fixed frontier near the bottom. The field is
// seeded with several courses synchronously at mount so it reads as
// mid-build immediately rather than growing from nothing.
// ---------------------------------------------------------------------------

const COURSE_PERIOD_MS = 500; // one course (shog + lap) per 500ms
const SHOG_SLIDE_MS = 200; // eased lateral slide before the lap segment lands
const SHOG_SPACES = 2; // "2 and 2" tricot chain: 2 needle-spaces per shog
const PITCH_DIVISOR = 27; // needle pitch derives from the smaller dimension
const PITCH_MIN = 8;
const PITCH_MAX = 14;
const COURSE_HEIGHT_RATIO = 9 / 11; // ~9px course height at ~11px pitch
const SETTLED_ALPHA = 0.62;
const GUIDE_ALPHA = 0.95;
const LINE_WIDTH = 1.15;

function easeOutCubic(x: number): number {
  const p = 1 - x;
  return 1 - p * p * p;
}

interface CourseRecord {
  k: number; // course index, worldY = k * courseHeight
  offsetPx: number; // committed lateral offset of the guide bar for this course
}

export interface WarpKnitTricotLappingProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function WarpKnitTricotLapping({
  className = "",
}: WarpKnitTricotLappingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let fg = "currentColor";
    let width = 0;
    let height = 0;
    let sized = false;
    let disposed = false;
    let visible = true;

    let pitch = 11;
    let courseHeight = 9;
    let cols = 0;
    let frontierY = 0; // fixed y of the active guide bar / newest course

    let history: CourseRecord[] = [];
    let k = 0; // next course index to commit
    let offsetPrev = 0; // committed offset (px) at the last committed course
    let offsetTarget = 0; // offset (px) this course is shogging toward
    let direction = 1; // +1 = right, -1 = left, flips every course
    let courseStart = 0; // ms timestamp the current course cycle began
    let committed = false; // has this course's segment already been drawn?
    let baseScroll = 0; // ms-based accumulated scroll at last course boundary

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = rect.width;
      height = rect.height;

      const smaller = Math.min(width, height);
      pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, smaller / PITCH_DIVISOR));
      courseHeight = pitch * COURSE_HEIGHT_RATIO;
      cols = Math.max(6, Math.round(width / pitch) + 2);
      frontierY = height - courseHeight;
      sized = true;
    };

    // world-y of a committed course (k=0 is the oldest ever seen) mapped to
    // screen space given how far the field has scrolled since it landed.
    const screenY = (courseK: number, scrollNow: number): number =>
      frontierY - (scrollNow - courseK * courseHeight);

    const scrollAt = (nowMs: number): number =>
      baseScroll + ((nowMs - courseStart) / COURSE_PERIOD_MS) * courseHeight;

    const commitCourse = () => {
      history.push({ k, offsetPx: offsetTarget });
      k += 1;
      committed = true;
      // cull courses once they've scrolled fully off the top
      const scrollNow = scrollAt(courseStart + COURSE_PERIOD_MS);
      while (history.length > 1) {
        const first = history[0];
        if (!first) break;
        if (screenY(first.k, scrollNow) < -courseHeight) history.shift();
        else break;
      }
    };

    const advanceCourse = () => {
      baseScroll = scrollAt(courseStart + COURSE_PERIOD_MS);
      courseStart += COURSE_PERIOD_MS;
      offsetPrev = offsetTarget;
      direction = -direction;
      offsetTarget = offsetPrev + direction * SHOG_SPACES * pitch;
      committed = false;
    };

    const draw = (nowMs: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);

      const scrollNow = scrollAt(nowMs);
      const tLocal = nowMs - courseStart;
      const slideT = Math.min(1, Math.max(0, tLocal / SHOG_SLIDE_MS));
      const guideOffset = committed
        ? offsetTarget
        : offsetPrev + (offsetTarget - offsetPrev) * easeOutCubic(slideT);

      ctx.strokeStyle = fg;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";

      // settled lap texture — every committed course-to-course pair
      ctx.globalAlpha = SETTLED_ALPHA;
      ctx.beginPath();
      for (let i = 1; i < history.length; i++) {
        const a = history[i - 1];
        const b = history[i];
        if (!a || !b) continue;
        const ay = screenY(a.k, scrollNow);
        const by = screenY(b.k, scrollNow);
        if (ay < -courseHeight && by < -courseHeight) continue;
        for (let n = 0; n < cols; n++) {
          const baseX = (n + 0.5) * pitch;
          ctx.moveTo(baseX + a.offsetPx, ay);
          ctx.lineTo(baseX + b.offsetPx, by);
        }
      }
      ctx.stroke();

      // guide bar indicator — one short tick per needle at the fixed
      // frontier, laterally offset by the guide's current (possibly still
      // sliding) position; this is the one thing to visually track each
      // course, moving right/left before the next commit lands the lap.
      const tick = courseHeight * 0.4;
      ctx.globalAlpha = GUIDE_ALPHA;
      ctx.beginPath();
      for (let n = 0; n < cols; n++) {
        const x = (n + 0.5) * pitch + guideOffset;
        ctx.moveTo(x, frontierY - tick);
        ctx.lineTo(x, frontierY + tick);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // Synchronously build `count` committed courses ending in a settled
    // (just-landed, never mid-slide) state, then anchor the clock so the
    // newest course sits exactly at the frontier. Used both to seed the
    // live field to "mid-build, filling most of the panel" at t0 (rather
    // than growing from nothing over ~15s) and to produce the reduced-motion
    // LAP_SETTLED freeze frame — the same construction, just never ticked.
    const seedField = (nowMs: number, count: number) => {
      history = [];
      k = 0;
      offsetPrev = 0;
      offsetTarget = SHOG_SPACES * pitch;
      direction = 1;
      for (let c = 0; c < count; c++) {
        history.push({ k, offsetPx: offsetTarget });
        k += 1;
        offsetPrev = offsetTarget;
        direction = -direction;
        offsetTarget = offsetPrev + direction * SHOG_SPACES * pitch;
      }
      committed = true;
      courseStart = nowMs;
      baseScroll = (count - 1) * courseHeight;
    };

    const coursesToFill = () => Math.ceil(height / courseHeight) + 2;

    let raf = 0;
    const GAP_RESET_MS = COURSE_PERIOD_MS * 20; // long tab-hidden gap: resync instead of replay

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;

      if (now - courseStart > GAP_RESET_MS) {
        seedField(now, coursesToFill());
      } else {
        // commit the course being left BEFORE advancing off it, every time,
        // so `k`/`baseScroll` can never skew apart on a multi-course catch-up
        while (now - courseStart >= COURSE_PERIOD_MS) {
          if (!committed) commitCourse();
          advanceCourse();
        }
        if (now - courseStart >= SHOG_SLIDE_MS && !committed) commitCourse();
      }

      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      resize();
      if (!sized) return;
      const nowMs = performance.now();
      seedField(nowMs, coursesToFill());
      if (reduced) {
        draw(nowMs);
        return;
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) {
        // re-anchor the frozen clock so scrollAt() still maps the same
        // settled field onto the frontier after an arbitrary real-time gap
        courseStart = performance.now();
        draw(courseStart);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        cancelAnimationFrame(raf);
        raf = 0;
        start();
      }, 80);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && sized && !raf) {
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(canvas);

    readTokens();
    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full text-foreground ${className}`}
    />
  );
}
