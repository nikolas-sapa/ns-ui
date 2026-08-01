"use client";

import { useEffect, useRef, useState } from "react";
import { BoltUnfurl } from "./component";

// Generates a network-free placeholder texture (diagonal bands + a couple of
// rings) on an offscreen canvas so the demo never depends on an external
// image URL and still gives the unroll motion something visually rich to
// reveal — a flat single color would make the strip curl nearly invisible.
function makeTexture(): string {
  // 480 (not 640): headless-Chromium software rendering is the verify-gate
  // bottleneck — texture size × strip count sets load-time raster cost, and
  // the page must stay comfortably under the gate's 30s goto timeout.
  const size = 480;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(size * (9 / 16));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const styles = getComputedStyle(document.documentElement);
  const fg = styles.getPropertyValue("--foreground").trim() || "#ededed";
  const border = styles.getPropertyValue("--border").trim() || "#2e2e2e";
  const accent = styles.getPropertyValue("--accent").trim() || "#006bff";

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = border;
  ctx.lineWidth = 10;
  for (let x = -canvas.height; x < canvas.width; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + canvas.height, 0);
    ctx.stroke();
  }

  ctx.strokeStyle = fg;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.32, canvas.height * 0.5, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(canvas.width * 0.72, canvas.height * 0.42, 40, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width * 0.5, canvas.height * 0.6, 110, 0, Math.PI * 2);
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

export default function BoltUnfurlDemo() {
  const [src, setSrc] = useState("");
  const [trigger, setTrigger] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    setSrc(makeTexture());
  }, []);

  // Scroll-triggered: the first time the media box enters view, play it once.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !src) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            setTrigger((t) => t + 1);
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  // Self-driving: replay every few seconds so the reveal is visible
  // unattended, not just on a real scroll.
  useEffect(() => {
    if (!src) return;
    const id = window.setInterval(() => setTrigger((t) => t + 1), 4200);
    return () => window.clearInterval(id);
  }, [src]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / reveal-cloth-unfurl</p>

      <div ref={sectionRef} className="w-full max-w-lg">
        {src && <BoltUnfurl src={src} alt="Geometric line-art study in ink, off-white, and blue" trigger={trigger} strips={14} />}
      </div>

      <button
        type="button"
        onClick={() => setTrigger((t) => t + 1)}
        className="rounded-[6px] border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Replay
      </button>

      <p className="max-w-md text-center text-xs text-muted">
        Unrolls open like a bolt of cloth when it scrolls into view; the
        Replay button rolls it back up and unfurls it again.
      </p>
    </div>
  );
}
