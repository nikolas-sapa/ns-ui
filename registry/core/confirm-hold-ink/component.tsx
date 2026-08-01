"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Press-and-hold destructive action, redesigned as an ink fill: holding pours
// monochrome ink up from the press point with a live meniscus edge and subtle
// grain; pressure microshake builds near the top; releasing early recoils the
// ink elastically; completion pops with one spring overshoot and swaps the
// label. Canvas colors derive from computed CSS tokens (re-derived on theme
// change), rAF sleeps when settled and pauses offscreen, reduced-motion gets a
// plain clean fill. Direct-DOM on the hot path — React state only at confirm.

type Mode = "idle" | "hold" | "recoil" | "pop";

export function HoldToConfirm({
  children,
  confirmedLabel = "Done",
  holdMs = 1200,
  onConfirm,
  className = "",
}: {
  children: ReactNode;
  confirmedLabel?: ReactNode;
  holdMs?: number;
  onConfirm?: () => void;
  className?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const holdMsRef = useRef(holdMs);
  holdMsRef.current = holdMs;

  const stateRef = useRef({
    mode: "idle" as Mode,
    p: 0, // fill progress 0..1
    v: 0, // recoil spring velocity (progress units / s)
    holding: false,
    done: false,
    pressX: 0.5, // normalized press point
    scale: 1,
    sv: 0, // pop spring velocity
    t: 0, // wave clock (ms)
    raf: 0,
    last: 0,
    w: 0,
    h: 0,
    dpr: 1,
    ink: "#ededed",
    grainColor: "#171717",
    reduced: false,
    visible: true,
    noise: null as HTMLCanvasElement | null,
    pattern: null as CanvasPattern | null,
  });

  useEffect(() => {
    const s = stateRef.current;
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const makeNoise = () => {
      const n = document.createElement("canvas");
      n.width = 128;
      n.height = 128;
      const nctx = n.getContext("2d");
      if (!nctx) return;
      nctx.fillStyle = s.grainColor;
      for (let i = 0; i < 2400; i++) {
        nctx.globalAlpha = Math.random() * 0.5;
        nctx.fillRect(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128), 1, 1);
      }
      s.noise = n;
      s.pattern = null; // rebuilt lazily against the drawing ctx
    };

    // canvas colors from computed tokens: ink = button text color (foreground),
    // grain = button background (surface) so texture reads inside the ink
    const syncColors = () => {
      const cs = getComputedStyle(btn);
      s.ink = cs.color;
      s.grainColor = cs.backgroundColor;
      makeNoise();
      draw();
    };

    const edgeY = (x: number, level: number) => {
      let y = level;
      // mound welling up at the press point, flattens as the fill matures
      const px = s.pressX * s.w;
      const spread = s.w * (0.1 + 0.9 * s.p);
      const mound = s.h * 1.5 * s.p * (1 - s.p) ** 2;
      y -= mound * Math.exp(-((x - px) ** 2) / (2 * spread * spread));
      // rippling waterline + pressure swell near the top
      const press = Math.min(1, Math.max(0, (s.p - 0.6) / 0.4));
      const live = s.holding ? 1.6 : Math.min(3, Math.abs(s.v) * 2.5);
      const amp = 1.2 + 2.6 * press + live;
      y += amp * 0.6 * Math.sin(x * 0.085 + s.t * 0.012);
      y += amp * 0.4 * Math.sin(x * 0.041 - s.t * 0.0085);
      return y;
    };

    const draw = () => {
      const { w, h, dpr } = s;
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (s.p <= 0.001) return;
      ctx.fillStyle = s.ink;
      if (s.p >= 0.999 || s.reduced) {
        // reduced motion: simple clean fill, no meniscus, no grain
        ctx.fillRect(0, h * (1 - s.p), w, h * s.p + 1);
        if (s.reduced) return;
      } else {
        const level = h * (1 - s.p);
        ctx.beginPath();
        ctx.moveTo(0, h + 2);
        for (let x = 0; x <= w; x += 3) ctx.lineTo(x, edgeY(x, level));
        ctx.lineTo(w, edgeY(w, level));
        ctx.lineTo(w, h + 2);
        ctx.closePath();
        ctx.fill();
      }
      // grain, clipped to the ink via source-atop
      if (s.noise) {
        if (!s.pattern) s.pattern = ctx.createPattern(s.noise, "repeat");
        if (s.pattern) {
          ctx.globalCompositeOperation = "source-atop";
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = s.pattern;
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }
    };

    const applyTransform = () => {
      if (s.mode === "hold") {
        const press = Math.min(1, Math.max(0, (s.p - 0.6) / 0.4));
        const j = s.reduced ? 0 : press * press * 1.6;
        const jx = (Math.random() - 0.5) * 2 * j;
        const jy = (Math.random() - 0.5) * 2 * j;
        btn.style.transform = `translate(${jx.toFixed(2)}px, ${jy.toFixed(2)}px) scale(0.985)`;
      } else if (s.mode === "recoil") {
        const squash = 1 - 0.015 * Math.min(1, s.p * 3);
        btn.style.transform = `scale(${squash.toFixed(4)})`;
      } else if (s.mode === "pop") {
        btn.style.transform = `scale(${s.scale.toFixed(4)})`;
      } else {
        btn.style.transform = "";
      }
    };

    const settle = () => {
      s.mode = "idle";
      s.raf = 0;
      applyTransform();
      draw();
    };

    const confirm = () => {
      s.p = 1;
      s.done = true;
      s.holding = false;
      if (s.reduced) {
        s.mode = "idle";
      } else {
        s.mode = "pop";
        s.scale = 0.97;
        s.sv = 0.6;
      }
      setConfirmed(true);
      onConfirmRef.current?.();
    };

    const tick = (now: number) => {
      const rawMs = now - s.last; // wall time, keeps hold duration honest across frame stalls
      const dtMs = Math.min(64, rawMs); // clamped for springs/waves so physics can't blow up
      s.last = now;
      const dt = dtMs / 1000;
      s.t += dtMs;

      if (s.mode === "hold") {
        s.p += rawMs / holdMsRef.current;
        if (s.p >= 1) confirm();
      } else if (s.mode === "recoil") {
        if (s.reduced) {
          s.p -= (dtMs / holdMsRef.current) * 2.5;
          if (s.p <= 0) {
            s.p = 0;
            draw();
            return settle();
          }
        } else {
          // elastic recoil: damped spring toward 0, bounce at the floor
          s.v += (-220 * s.p - 16 * s.v) * dt;
          s.p += s.v * dt;
          if (s.p <= 0) {
            s.p = 0;
            s.v = -s.v * 0.3;
          }
          if (s.p < 0.008 && Math.abs(s.v) < 0.2) {
            s.p = 0;
            draw();
            return settle();
          }
        }
      } else if (s.mode === "pop") {
        s.sv += ((1 - s.scale) * 300 - 12 * s.sv) * dt;
        s.scale += s.sv * dt;
        if (Math.abs(s.scale - 1) < 0.001 && Math.abs(s.sv) < 0.01) {
          s.scale = 1;
          draw();
          return settle();
        }
      } else {
        return settle();
      }

      draw();
      applyTransform();
      if (s.visible) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.raf = 0;
      }
    };

    const wake = () => {
      if (s.raf || s.mode === "idle" || !s.visible) return;
      s.last = performance.now();
      s.raf = requestAnimationFrame(tick);
    };

    const startHold = (pressX: number) => {
      if (s.done || s.mode === "pop") return;
      s.holding = true;
      s.mode = "hold";
      s.pressX = pressX;
      s.v = 0;
      wake();
    };

    const release = () => {
      if (!s.holding || s.done) return;
      s.holding = false;
      if (s.p > 0) {
        s.mode = "recoil";
        s.v = -1.2; // initial elastic kick downward
        wake();
      } else {
        s.mode = "idle";
        applyTransform();
      }
    };

    // wire input through the element so cleanup is guaranteed
    const onPointerDown = (e: PointerEvent) => {
      btn.setPointerCapture(e.pointerId);
      const r = btn.getBoundingClientRect();
      startHold(r.width ? (e.clientX - r.left) / r.width : 0.5);
    };
    const onPointerEnd = () => release();
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        startHold(0.5);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") release();
    };
    btn.addEventListener("pointerdown", onPointerDown);
    btn.addEventListener("pointerup", onPointerEnd);
    btn.addEventListener("pointercancel", onPointerEnd);
    btn.addEventListener("lostpointercapture", onPointerEnd);
    btn.addEventListener("keydown", onKeyDown);
    btn.addEventListener("keyup", onKeyUp);
    btn.addEventListener("blur", onPointerEnd);

    const ro = new ResizeObserver(() => {
      const r = btn.getBoundingClientRect();
      s.w = r.width;
      s.h = r.height;
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(s.w * s.dpr));
      canvas.height = Math.max(1, Math.round(s.h * s.dpr));
      draw();
    });
    ro.observe(btn);

    const io = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting;
      if (s.visible) wake();
      else if (s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
      }
    });
    io.observe(btn);

    const mo = new MutationObserver(syncColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      s.reduced = mq.matches;
      draw();
    };
    onMq();
    mq.addEventListener("change", onMq);

    syncColors();

    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onMq);
      btn.removeEventListener("pointerdown", onPointerDown);
      btn.removeEventListener("pointerup", onPointerEnd);
      btn.removeEventListener("pointercancel", onPointerEnd);
      btn.removeEventListener("lostpointercapture", onPointerEnd);
      btn.removeEventListener("keydown", onKeyDown);
      btn.removeEventListener("keyup", onKeyUp);
      btn.removeEventListener("blur", onPointerEnd);
    };
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      className={[
        "relative isolate inline-flex select-none touch-none items-center justify-center overflow-hidden",
        "rounded-sm border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground",
        "hover:border-muted hover:bg-border/60",
        "transition-[border-color,background-color] duration-150",
        "focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      ].join(" ")}
    >
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* difference blend inverts the label wherever the ink covers it */}
      <span className="relative z-10" style={{ mixBlendMode: "difference", color: "#fff" }}>
        {confirmed ? confirmedLabel : children}
      </span>
    </button>
  );
}
